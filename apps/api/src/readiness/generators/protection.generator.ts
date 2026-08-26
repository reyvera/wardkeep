import { Decimal } from 'decimal.js';
import { AccountType, PrismaClient } from '@prisma/client';

import { calculateBalance } from '@wardkeep/finance-engine';
import { Transaction, TransactionStatus, TransactionType } from '@wardkeep/shared';
import { Signal } from '@wardkeep/readiness';
import { calculateHouseholdBurnRate, HouseholdBurnRate } from './burn-rate';
import { excludeMatchedCreditCardPayments } from './payment-matching';

/** A full year is deliberately required for a maximum liquidity score. */
const MAXIMUM_MONTHS = 12;
const MINIMUM_MONTHS = 3;

/**
 * Generates readiness signals for the Protection pillar.
 * Covers: liquid-reserve coverage relative to a conservative household burn rate.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of readiness signals for the protection pillar
 */
export async function generateProtectionSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const signals: Signal[] = [];

  const emergencyFundSignals = await generateEmergencyFundSignals(prisma, userId);
  const insuranceSignals = await generateInsuranceSignals(prisma, userId);
  const estateDocumentSignals = await generateEstateDocumentSignals(prisma, userId);
  const incomeSources = await prisma.incomeSource.findMany({ where: { userId, isActive: true }, select: { name: true, reviewDate: true } });
  const incomeSignals = incomeSources.map((source) => incomeSourceReviewSignal(source, new Date())).filter((signal): signal is Signal => signal !== null);
  if (incomeSources.length > 0 && incomeSignals.length === 0) incomeSignals.push({ capabilityId: 'income-sources', type: 'positive', magnitude: 1, pillar: 'protection', weight: 0.5, summary: `${incomeSources.length} active income ${incomeSources.length === 1 ? 'source is' : 'sources are'} recorded. Wardkeep does not infer job security, payment continuity, or income-interruption resilience.` });
  const secondaryLiquiditySignals = await generateSecondaryLiquiditySignals(prisma, userId);
  const fixedObligationSignals = await generateFixedObligationSignals(prisma, userId);
  const dependents = await prisma.dependent.findMany({ where: { userId, isActive: true }, select: { label: true, relationship: true, reviewDate: true } });
  const dependentSignals = dependents.map((dependent) => dependentReviewSignal(dependent, new Date())).filter((signal): signal is Signal => signal !== null);
  if (dependents.length > 0 && dependentSignals.length === 0) dependentSignals.push({ capabilityId: 'dependents', type: 'positive', magnitude: 1, pillar: 'protection', weight: 0.5, summary: `${dependents.length} active dependent ${dependents.length === 1 ? 'record is' : 'records are'} entered. Wardkeep does not assess care needs, coverage adequacy, or financial responsibility.` });
  signals.push(...emergencyFundSignals, ...insuranceSignals, ...estateDocumentSignals, ...incomeSignals, ...secondaryLiquiditySignals, ...fixedObligationSignals, ...dependentSignals);

  return signals;
}

export function dependentReviewSignal(dependent: { label: string | null; relationship: string; reviewDate: Date | null }, now: Date): Signal | null { if (!dependent.reviewDate) return null; const today = new Date(now); today.setHours(0, 0, 0, 0); const days = Math.ceil((dependent.reviewDate.getTime() - today.getTime()) / 86_400_000); const name = dependent.label || dependent.relationship.toLowerCase(); if (days < 0) return { capabilityId: 'dependents', type: 'warning', magnitude: -2, pillar: 'protection', weight: 0.5, summary: `${name} has a review date that has passed. Confirm household planning context is current.` }; if (days <= 30) return { capabilityId: 'dependents', type: 'warning', magnitude: -1, pillar: 'protection', weight: 0.5, summary: `${name} is due for a household-planning review in ${days} days.` }; return null; }

/** Checks known debt minimums and recurring bills without estimating omitted obligations. */
async function generateFixedObligationSignals(prisma: PrismaClient, userId: string): Promise<Signal[]> {
  const profiles = await prisma.debtProfile.findMany({
    where: { userId },
    select: { minimumPayment: true },
  });
  const recurringBills = await prisma.recurringTransaction.findMany({
    where: { userId, isConfirmed: true, isActive: true },
    select: { expectedAmount: true, frequency: true },
  });
  const manualObligations = await prisma.householdObligation.findMany({
    where: { userId, isActive: true },
    select: { monthlyAmount: true, isVariable: true },
  });
  const monthlyDebtMinimums = profiles.reduce(
    (total, profile) => total.add(new Decimal(profile.minimumPayment.toString())),
    new Decimal(0),
  );
  const monthlyRecurringBills = recurringBills.reduce(
    (total, bill) => total.add(monthlyRecurringAmount(bill.expectedAmount, bill.frequency)),
    new Decimal(0),
  );
  const monthlyManualObligations = manualObligations.reduce(
    (total, obligation) => total.add(new Decimal(obligation.monthlyAmount.toString())),
    new Decimal(0),
  );
  if (monthlyDebtMinimums.add(monthlyRecurringBills).add(monthlyManualObligations).lte(0)) return [];
  const reserves = await calculateLiquidReserves(prisma, userId);
  return fixedObligationSignal({
    monthlyDebtMinimums,
    monthlyRecurringBills,
    monthlyManualObligations,
    variableManualObligationCount: manualObligations.filter((obligation) => obligation.isVariable).length,
    reserves,
  });
}

/** Converts a confirmed recurring amount to its monthly equivalent. */
export function monthlyRecurringAmount(
  amount: Decimal | { toString(): string },
  frequency: string,
): Decimal {
  const monthlyMultiplierByFrequency: Record<string, Decimal> = {
    WEEKLY: new Decimal(52).div(12),
    BIWEEKLY: new Decimal(26).div(12),
    MONTHLY: new Decimal(1),
    QUARTERLY: new Decimal(1).div(3),
    SEMIANNUAL: new Decimal(1).div(6),
    ANNUAL: new Decimal(1).div(12),
  };
  const multiplier = monthlyMultiplierByFrequency[frequency];
  return multiplier ? new Decimal(amount.toString()).mul(multiplier) : new Decimal(0);
}

/** Creates a warning only when known monthly commitments exceed liquid reserves. */
export function fixedObligationSignal(input: {
  monthlyDebtMinimums: Decimal;
  monthlyRecurringBills: Decimal;
  monthlyManualObligations: Decimal;
  variableManualObligationCount: number;
  reserves: Decimal;
}): Signal[] {
  const monthlyObligations = input.monthlyDebtMinimums
    .add(input.monthlyRecurringBills)
    .add(input.monthlyManualObligations);
  if (monthlyObligations.lte(0) || monthlyObligations.lte(input.reserves)) return [];
  const components = [
    input.monthlyDebtMinimums.gt(0)
      ? `$${input.monthlyDebtMinimums.toFixed(2)} in debt minimums`
      : null,
    input.monthlyRecurringBills.gt(0)
      ? `$${input.monthlyRecurringBills.toFixed(2)} in confirmed recurring bills`
      : null,
    input.monthlyManualObligations.gt(0)
      ? `$${input.monthlyManualObligations.toFixed(2)} in entered external commitments${input.variableManualObligationCount > 0 ? ` (${input.variableManualObligationCount} marked variable)` : ''}`
      : null,
  ].filter((component): component is string => component !== null);
  return [{
    capabilityId: 'fixed-obligations',
    type: 'warning',
    magnitude: -2,
    pillar: 'protection',
    weight: 0.75,
    summary: `Recorded monthly commitments total $${monthlyObligations.toFixed(2)} (${components.join(' and ')}), above $${input.reserves.toFixed(2)} in liquid reserves. Amounts marked variable are household estimates; unrecorded commitments are not included.`,
    financialImpact: {
      amount: monthlyObligations.sub(input.reserves).toFixed(2),
      monthlyAmount: monthlyObligations.toFixed(2),
      label: 'Recorded commitment shortfall',
    },
  }];
}

/**
 * A nearly exhausted recorded credit line is a modest warning. Available credit
 * is deliberately not counted as cash or a positive emergency-fund contribution.
 */
async function generateSecondaryLiquiditySignals(prisma: PrismaClient, userId: string): Promise<Signal[]> {
  const cards = await prisma.account.findMany({
    where: { userId, isArchived: false, type: AccountType.CREDIT_CARD, creditLimit: { not: null } },
    include: { transactions: true, linkedBankAccounts: { select: { id: true } } },
  });
  const signals: Signal[] = [];
  for (const card of cards) {
    const limit = new Decimal(card.creditLimit!.toString());
    if (limit.lte(0)) continue;
    const balance = card.linkedBankAccounts.length > 0
      ? new Decimal(card.initialBalance.toString())
      : calculateBalance(new Decimal(card.initialBalance.toString()), card.transactions.map((transaction) => ({ ...transaction, amount: transaction.amount.toString(), aiConfidence: transaction.aiConfidence?.toString() ?? null })));
    const available = Decimal.max(0, limit.sub(Decimal.max(0, balance.abs())));
    if (available.div(limit).lte(0.1)) signals.push({
      capabilityId: 'secondary-liquidity', type: 'warning', magnitude: -1, pillar: 'protection', weight: 0.5,
      summary: `${card.name} has $${available.toFixed(2)} of $${limit.toFixed(2)} in recorded available credit. This is borrowing capacity, not cash reserves.`,
    });
  }
  return signals;
}

/** Reminds about a household-entered income-context review, not income security. */
export function incomeSourceReviewSignal(source: { name: string; reviewDate: Date | null }, now: Date): Signal | null {
  if (!source.reviewDate) return null;
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const days = Math.ceil((source.reviewDate.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { capabilityId: 'income-sources', type: 'warning', magnitude: -2, pillar: 'protection', weight: 0.5, summary: `${source.name} has a review date that has passed. Confirm your income context is still current.` };
  if (days <= 30) return { capabilityId: 'income-sources', type: 'warning', magnitude: -1, pillar: 'protection', weight: 0.5, summary: `${source.name} is due for review in ${days} days.` };
  return null;
}

/**
 * Records document-review timing only. A listed document is not evidence that it
 * is valid, current, accessible, or appropriate for the household.
 */
async function generateEstateDocumentSignals(prisma: PrismaClient, userId: string): Promise<Signal[]> {
  const documents = await prisma.estateDocument.findMany({
    where: { userId, isActive: true },
    select: { type: true, title: true, reviewDate: true },
  });
  if (documents.length === 0) return [];

  const reviewSignals = documents
    .map((document) => estateDocumentReviewSignal(document, new Date()))
    .filter((signal): signal is Signal => signal !== null);
  if (reviewSignals.length > 0) return reviewSignals;

  return [{
    capabilityId: 'estate-documents',
    type: 'positive',
    magnitude: 1,
    pillar: 'protection',
    summary: `${documents.length} active estate-planning ${documents.length === 1 ? 'record is' : 'records are'} recorded. Wardkeep does not assess legal validity, beneficiary choices, or adequacy.`,
    weight: 0.5,
  }];
}

/** Classifies a recorded review date without making a legal-adequacy claim. */
export function estateDocumentReviewSignal(
  document: { type: string; title: string | null; reviewDate: Date | null },
  now: Date,
): Signal | null {
  if (!document.reviewDate) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilReview = Math.ceil(
    (document.reviewDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  const documentName = document.title || document.type.toLowerCase().replace(/_/g, ' ');
  if (daysUntilReview < 0) return {
    capabilityId: 'estate-documents',
    type: 'warning',
    magnitude: -3,
    pillar: 'protection',
    summary: `${documentName} has a review date that has passed. Consider reviewing it with the appropriate professional.`,
    weight: 0.75,
  };
  if (daysUntilReview <= 30) return {
    capabilityId: 'estate-documents',
    type: 'warning',
    magnitude: -2,
    pillar: 'protection',
    summary: `${documentName} is due for review in ${daysUntilReview} days.`,
    weight: 0.75,
  };
  return null;
}

/**
 * Records insurance renewal risk without claiming that entered policies are adequate.
 * The presence of records is an observed factor; policy limits and household needs are
 * deliberately not converted into an adequacy score until Wardkeep can evaluate them.
 */
async function generateInsuranceSignals(prisma: PrismaClient, userId: string): Promise<Signal[]> {
  const policies = await prisma.insurancePolicy.findMany({
    where: { userId, isActive: true },
    select: {
      type: true,
      provider: true,
      renewalDate: true,
      deductible: true,
      coverageAmount: true,
      coverageTargetAmount: true,
    },
  });
  if (policies.length === 0) return [];

  const signals: Signal[] = [];
  for (const policy of policies) {
    const renewalSignal = insuranceRenewalSignal(policy, new Date());
    if (renewalSignal) signals.push(renewalSignal);
  }
  if (signals.length === 0) {
    signals.push({
      capabilityId: 'insurance',
      type: 'positive',
      magnitude: 1,
      pillar: 'protection',
      summary: `${policies.length} active insurance ${policies.length === 1 ? 'policy is' : 'policies are'} recorded. Wardkeep does not yet assess coverage adequacy.`,
      weight: 0.5,
    });
  }
  const incompletePolicies = policies.filter(
    (policy) => !policy.renewalDate || !policy.deductible || !policy.coverageAmount,
  );
  if (incompletePolicies.length > 0) {
    signals.push({
      capabilityId: 'insurance-record-details',
      type: 'warning',
      magnitude: -2,
      pillar: 'protection',
      summary: `${incompletePolicies.length} recorded insurance ${incompletePolicies.length === 1 ? 'policy is' : 'policies are'} missing a renewal date, deductible, or coverage amount. This requests record detail; it does not determine coverage adequacy.`,
      weight: 0.75,
    });
  }
  for (const policy of policies) {
    const coverageTargetSignal = insuranceCoverageTargetSignal(policy);
    if (coverageTargetSignal) signals.push(coverageTargetSignal);
  }
  const recordedDeductibles = policies
    .map((policy) => (policy.deductible ? new Decimal(policy.deductible.toString()) : null))
    .filter((deductible): deductible is Decimal => deductible !== null);
  if (recordedDeductibles.length > 0) {
    const totalDeductibles = recordedDeductibles.reduce(
      (sum, deductible) => sum.add(deductible),
      new Decimal(0),
    );
    const liquidReserves = await calculateLiquidReserves(prisma, userId);
    if (totalDeductibles.gt(liquidReserves)) {
      signals.push({
        capabilityId: 'insurance-deductibles',
        type: 'warning',
        magnitude: -3,
        pillar: 'protection',
        summary: `Recorded deductibles total $${totalDeductibles.toFixed(2)}, above $${liquidReserves.toFixed(2)} in liquid reserves. This is an out-of-pocket resilience check, not an insurance adequacy assessment.`,
        weight: 1,
        financialImpact: {
          amount: totalDeductibles.sub(liquidReserves).toFixed(2),
          label: 'Recorded deductible reserve gap',
        },
      });
    }
  }
  return signals;
}

/**
 * Compares a policy amount with a target entered by the household. This is a
 * record-comparison check only: it does not establish that the target is right
 * for the household or that the policy will pay a claim.
 *
 * @param policy The recorded policy coverage and optional household target.
 * @returns A warning when the recorded amount is below the entered target.
 */
export function insuranceCoverageTargetSignal(policy: {
  type: string;
  provider: string;
  coverageAmount: Decimal | { toString(): string } | null;
  coverageTargetAmount: Decimal | { toString(): string } | null;
}): Signal | null {
  if (!policy.coverageAmount || !policy.coverageTargetAmount) return null;
  const coverage = new Decimal(policy.coverageAmount.toString());
  const target = new Decimal(policy.coverageTargetAmount.toString());
  if (coverage.gte(target)) return null;
  const policyName = `${policy.provider} ${policy.type.toLowerCase().replace('_', ' ')}`;
  return {
    capabilityId: 'insurance-coverage-target',
    type: 'warning',
    magnitude: -2,
    pillar: 'protection',
    summary: `${policyName} has $${coverage.toFixed(2)} recorded against your $${target.toFixed(2)} coverage target. Review the policy and target; Wardkeep does not determine whether either amount is adequate.`,
    weight: 0.75,
  };
}

/** Classifies a recorded renewal date without making an insurance-adequacy claim. */
export function insuranceRenewalSignal(
  policy: { type: string; provider: string; renewalDate: Date | null },
  now: Date,
): Signal | null {
  if (!policy.renewalDate) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const daysUntilRenewal = Math.ceil(
    (policy.renewalDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
  );
  const policyName = `${policy.provider} ${policy.type.toLowerCase().replace('_', ' ')}`;
  if (daysUntilRenewal < 0)
    return {
      capabilityId: 'insurance',
      type: 'risk',
      magnitude: -6,
      pillar: 'protection',
      summary: `${policyName} shows a renewal date that has passed. Confirm the policy is active.`,
      weight: 1,
    };
  if (daysUntilRenewal <= 30)
    return {
      capabilityId: 'insurance',
      type: 'warning',
      magnitude: -3,
      pillar: 'protection',
      summary: `${policyName} renews in ${daysUntilRenewal} days. Review the policy before it renews.`,
      weight: 1,
    };
  return null;
}

async function calculateLiquidReserves(prisma: PrismaClient, userId: string): Promise<Decimal> {
  const liquidTypes: AccountType[] = [AccountType.CHECKING, AccountType.SAVINGS, AccountType.CASH];
  const accounts = await prisma.account.findMany({
    where: { userId, isArchived: false, type: { in: liquidTypes } },
    include: { transactions: true, linkedBankAccounts: { select: { id: true } } },
  });
  return accounts.reduce((total, account) => {
    const balance =
      account.linkedBankAccounts.length > 0
        ? new Decimal(account.initialBalance.toString())
        : calculateBalance(
            new Decimal(account.initialBalance.toString()),
            account.transactions.map((tx): Transaction => ({
              id: tx.id,
              userId: tx.userId,
              accountId: tx.accountId,
              categoryId: tx.categoryId,
              date: tx.date,
              amount: tx.amount.toString(),
              type: tx.type as unknown as TransactionType,
              status: tx.status as unknown as TransactionStatus,
              merchant: tx.merchant,
              description: tx.description,
              notes: tx.notes,
              isReconciliation: tx.isReconciliation,
              aiCategorized: tx.aiCategorized,
              aiConfidence: tx.aiConfidence?.toString() ?? null,
              createdAt: tx.createdAt,
              updatedAt: tx.updatedAt,
            })),
          );
    return balance.gt(0) ? total.add(balance) : total;
  }, new Decimal(0));
}

/**
 * Generates signals based on emergency fund coverage.
 * Compares liquid savings to average monthly expenses to determine
 * how many months the household could sustain without income.
 * @param prisma - Prisma client instance
 * @param userId - The authenticated user's ID
 * @returns Array of emergency-fund signals
 */
async function generateEmergencyFundSignals(
  prisma: PrismaClient,
  userId: string,
): Promise<Signal[]> {
  const totalLiquid = await calculateLiquidReserves(prisma, userId);

  // TransactionType.TRANSFER records are excluded structurally. The burn-rate
  // helper additionally removes common imported transfers mislabeled as debits.
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const debitTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.DEBIT,
      date: { gte: ninetyDaysAgo },
    },
    include: {
      account: { select: { type: true } },
      category: { select: { name: true } },
      tags: { select: { tag: true } },
    },
  });
  const refunds = await prisma.transaction.findMany({
    where: { userId, type: TransactionType.CREDIT, refundForTransactionId: { in: debitTransactions.map((tx) => tx.id) } },
    select: { refundForTransactionId: true, amount: true },
  });
  const refundsByPurchase = new Map<string, Decimal>();
  for (const refund of refunds) if (refund.refundForTransactionId) refundsByPurchase.set(refund.refundForTransactionId, (refundsByPurchase.get(refund.refundForTransactionId) ?? new Decimal(0)).plus(refund.amount.toString()));
  const cardPaymentCredits = await prisma.transaction.findMany({
    where: {
      userId,
      type: TransactionType.CREDIT,
      date: { gte: ninetyDaysAgo },
      account: { type: AccountType.CREDIT_CARD, isArchived: false },
    },
    select: { id: true, amount: true, date: true },
  });
  const possibleCardPaymentDebits = debitTransactions.filter(
    (transaction) =>
      transaction.account.type === AccountType.CHECKING ||
      transaction.account.type === AccountType.SAVINGS,
  );
  const retainedCardPaymentDebitIds = new Set(
    excludeMatchedCreditCardPayments(possibleCardPaymentDebits, cardPaymentCredits).map(
      (transaction) => transaction.id,
    ),
  );
  const householdDebits = debitTransactions.filter(
    (transaction) =>
      !possibleCardPaymentDebits.some((candidate) => candidate.id === transaction.id) ||
      retainedCardPaymentDebitIds.has(transaction.id),
  );

  const burnRate = calculateHouseholdBurnRate(
    householdDebits.map((transaction) => ({
      amount: new Decimal(transaction.amount.toString()).minus(refundsByPurchase.get(transaction.id) ?? 0).toFixed(2),
      categoryName: transaction.category?.name,
      merchant: transaction.merchant,
      description: transaction.description,
      tags: transaction.tags.map((tag) => tag.tag),
    })),
  );
  return emergencyFundSignal(totalLiquid, burnRate);
}

/**
 * Produces the explainable liquidity signal from already-calculated reserves and burn rate.
 * Exported for deterministic coverage-band tests; it deliberately does not make advice claims.
 */
export function emergencyFundSignal(totalLiquid: Decimal, burnRate: HouseholdBurnRate): Signal[] {
  const signals: Signal[] = [];
  const monthlyExpenses = burnRate.essentialMonthly;

  if (monthlyExpenses.isZero()) {
    signals.push({
      capabilityId: 'emergency-fund',
      type: 'warning',
      magnitude: -5,
      pillar: 'protection',
      summary: `Wardkeep found $${totalLiquid.toFixed(2)} in liquid savings but cannot calculate coverage without ordinary expense history.`,
      weight: 1,
    });
    return signals;
  }

  const monthsCoverage = totalLiquid.div(monthlyExpenses);
  // A linear curve keeps incremental progress visible: 0 / 1 / 3 / 6 / 12
  // months map to roughly 10 / 18 / 33 / 55 / 100, respectively.
  const cappedMonths = Decimal.min(monthsCoverage, MAXIMUM_MONTHS);
  const readiness = cappedMonths.div(MAXIMUM_MONTHS).mul(90).add(10);
  const magnitude = readiness.sub(100).div(10).toNumber();
  const targetMonths = monthsCoverage.lt(MINIMUM_MONTHS) ? MINIMUM_MONTHS : 6;
  const amountNeeded = Decimal.max(0, new Decimal(targetMonths).sub(monthsCoverage))
    .mul(monthlyExpenses)
    .toFixed(2);
  const type = readiness.gte(75) ? 'positive' : readiness.gte(45) ? 'warning' : 'risk';
  const targetText = monthsCoverage.gte(6)
    ? `A ${MAXIMUM_MONTHS}-month reserve is the maximum readiness benchmark.`
    : `$${amountNeeded} more reaches the ${targetMonths}-month milestone.`;

  signals.push({
    capabilityId: 'emergency-fund',
    type,
    magnitude,
    pillar: 'protection',
    summary: `Liquid reserves cover ${monthsCoverage.toFixed(1)} months of ${burnRate.usesNormalFallback ? 'ordinary' : 'essential'} expenses${burnRate.usesNormalFallback ? ' (essential expenses are not categorized yet)' : ''}. ${targetText}`,
    weight: 2,
    financialImpact: new Decimal(amountNeeded).gt(0)
      ? { amount: amountNeeded, label: 'Recorded reserve target gap' }
      : undefined,
  });

  return signals;
}
