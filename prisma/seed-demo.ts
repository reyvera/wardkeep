/**
 * Demo seed script — creates a demo user with 6 months of realistic financial data.
 * Run with: npx ts-node prisma/seed-demo.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEMO_EMAIL = 'demo@wardkeep.app';
const DEMO_PASSWORD = 'DemoPassword123';

// ─── Merchants and categories ────────────────────────────────────────────────

const MERCHANTS = {
  Groceries: ['Whole Foods', 'Trader Joes', 'Kroger', 'Safeway', 'Costco', 'Aldi'],
  Restaurants: ['Chipotle', 'Starbucks', 'McDonalds', 'Panera Bread', 'Olive Garden', 'Five Guys'],
  Transportation: ['Shell Gas', 'BP Gas', 'Uber', 'Lyft', 'Metro Transit'],
  Entertainment: ['Netflix', 'Spotify', 'AMC Theaters', 'Steam Games', 'Audible'],
  Shopping: ['Amazon', 'Target', 'Walmart', 'Best Buy', 'Nike', 'H&M'],
  Utilities: ['Electric Co', 'Water Utility', 'Comcast Internet', 'T-Mobile'],
  Healthcare: ['CVS Pharmacy', 'Dr Smith Office', 'Blue Cross'],
  Housing: ['Apt Rent LLC', 'State Farm Insurance'],
  Subscriptions: ['iCloud Storage', 'ChatGPT Plus', 'GitHub Pro', 'Notion'],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Keep the fixture repeatable. Dates remain relative to today, but all amounts,
// merchants, and account choices are stable for screenshots and verification.
let randomState = 0x57_41_52_44;

function demoRandom(): number {
  randomState = (randomState * 1_664_525 + 1_013_904_223) >>> 0;
  return randomState / 0x1_0000_0000;
}

function randomBetween(min: number, max: number): number {
  return Math.round((demoRandom() * (max - min) + min) * 100) / 100;
}

function randomDate(monthsAgo: number): Date {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  // Do not create future activity in the current month. Leave today reserved
  // for the transaction-review inbox records below so they are easy to find.
  const end =
    monthsAgo === 0
      ? new Date(now.getFullYear(), now.getMonth(), Math.max(1, now.getDate() - 1), 23, 59, 59)
      : new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0, 23, 59, 59);
  return new Date(start.getTime() + demoRandom() * (end.getTime() - start.getTime()));
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(demoRandom() * arr.length)]!;
}

function nextMonthlyDate(dayOfMonth: number): Date {
  const next = new Date();
  next.setHours(0, 0, 0, 0);
  next.setDate(dayOfMonth);
  if (next.getTime() <= Date.now()) next.setMonth(next.getMonth() + 1);
  return next;
}

async function main() {
  console.log('🌱 Seeding demo data...');

  // Clean existing demo user
  const existing = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } });
  if (existing) {
    // Delete all user data (order matters for foreign key constraints)
    await prisma.transactionTag.deleteMany({
      where: { transaction: { account: { userId: existing.id } } },
    });
    await prisma.transaction.deleteMany({ where: { account: { userId: existing.id } } });
    await prisma.recurringTransaction.deleteMany({ where: { userId: existing.id } });
    await prisma.budgetAllocation.deleteMany({ where: { budget: { userId: existing.id } } });
    await prisma.budget.deleteMany({ where: { userId: existing.id } });
    await prisma.debtProfile.deleteMany({ where: { userId: existing.id } });
    await prisma.savedPayoffPlan.deleteMany({ where: { userId: existing.id } });
    await prisma.linkedBankAccount.deleteMany({ where: { connection: { userId: existing.id } } });
    await prisma.bankConnection.deleteMany({ where: { userId: existing.id } });
    await prisma.insurancePolicy.deleteMany({ where: { userId: existing.id } });
    await prisma.estateDocument.deleteMany({ where: { userId: existing.id } });
    await prisma.incomeSource.deleteMany({ where: { userId: existing.id } });
    await prisma.dependent.deleteMany({ where: { userId: existing.id } });
    await prisma.householdObligation.deleteMany({ where: { userId: existing.id } });
    await prisma.plannedExpense.deleteMany({ where: { userId: existing.id } });
    await prisma.financialGoal.deleteMany({ where: { userId: existing.id } });
    await prisma.recommendation.deleteMany({ where: { userId: existing.id } });
    await prisma.advisorInsight.deleteMany({ where: { userId: existing.id } });
    await prisma.readinessSignal.deleteMany({ where: { userId: existing.id } });
    await prisma.readinessSnapshot.deleteMany({ where: { userId: existing.id } });
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.ruleCondition.deleteMany({ where: { rule: { userId: existing.id } } });
    await prisma.ruleAction.deleteMany({ where: { rule: { userId: existing.id } } });
    await prisma.rule.deleteMany({ where: { userId: existing.id } });
    await prisma.category.deleteMany({ where: { userId: existing.id } });
    await prisma.chatMessage.deleteMany({ where: { session: { userId: existing.id } } });
    await prisma.chatSession.deleteMany({ where: { userId: existing.id } });
    await prisma.aICorrection.deleteMany({ where: { userId: existing.id } });
    await prisma.auditLog.deleteMany({ where: { userId: existing.id } });
    await prisma.backup.deleteMany({ where: { userId: existing.id } });
    await prisma.userSettings.deleteMany({ where: { userId: existing.id } });
    await prisma.passwordResetToken.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Create demo user
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      passwordHash,
    },
  });

  console.log(`  ✓ Created user: ${DEMO_EMAIL}`);

  // Create categories
  const categoryNames = [
    'Income',
    'Groceries',
    'Restaurants',
    'Transportation',
    'Entertainment',
    'Shopping',
    'Utilities',
    'Healthcare',
    'Housing',
    'Subscriptions',
    'Savings',
  ];

  const categories: Record<string, string> = {};
  for (const name of categoryNames) {
    const cat = await prisma.category.create({
      data: { name, userId: user.id, isDefault: false },
    });
    categories[name] = cat.id;
  }
  console.log(`  ✓ Created ${categoryNames.length} categories`);

  // Create accounts
  const checking = await prisma.account.create({
    data: { name: 'Chase Checking', type: 'CHECKING', userId: user.id, initialBalance: '4500.00' },
  });
  const _savings = await prisma.account.create({
    data: { name: 'Ally Savings', type: 'SAVINGS', userId: user.id, initialBalance: '12000.00' },
  });
  const creditCard = await prisma.account.create({
    data: {
      name: 'Amex Blue Cash',
      type: 'CREDIT_CARD',
      userId: user.id,
      initialBalance: '1847.32',
    },
  });
  const _mortgage = await prisma.account.create({
    data: { name: 'Home Mortgage', type: 'MORTGAGE', userId: user.id, initialBalance: '245000.00' },
  });

  console.log('  ✓ Created 4 accounts');

  // Create debt profiles for liability accounts (auto-sync with debt payoff)
  await prisma.debtProfile.create({
    data: {
      userId: user.id,
      accountId: creditCard.id,
      apr: '0.1999',
      minimumPayment: '35.00',
      priority: 1,
    },
  });
  await prisma.debtProfile.create({
    data: {
      userId: user.id,
      accountId: _mortgage.id,
      apr: '0.0675',
      minimumPayment: '1580.00',
      priority: 2,
    },
  });
  console.log('  ✓ Created debt profiles for liability accounts');

  await prisma.savedPayoffPlan.create({
    data: {
      userId: user.id,
      name: 'Credit card payoff',
      accountIds: [creditCard.id],
      strategy: 'avalanche',
      totalMonthlyPayment: '600.00',
      totalInterest: '318.00',
      totalMonths: 6,
    },
  });
  console.log('  ✓ Created a 6-month debt payoff-plan projection');

  // Create insurance policies for the Protection dashboard. The auto renewal is
  // intentionally near-term so the demo visibly exercises renewal awareness.
  const renewalSoon = new Date();
  renewalSoon.setDate(renewalSoon.getDate() + 21);
  const homeRenewal = new Date();
  homeRenewal.setMonth(homeRenewal.getMonth() + 6);
  await prisma.insurancePolicy.createMany({
    data: [
      {
        userId: user.id,
        type: 'AUTO',
        provider: 'State Farm',
        nickname: 'Family car',
        premium: '186.00',
        premiumFrequency: 'MONTHLY',
        deductible: '1000.00',
        coverageAmount: '100000.00',
        renewalDate: renewalSoon,
        notes: 'Review renewal offer and compare the deductible before the renewal date.',
      },
      {
        userId: user.id,
        type: 'HOME',
        provider: 'Travelers',
        nickname: 'Homeowners',
        premium: '2140.00',
        premiumFrequency: 'ANNUAL',
        paymentArrangement: 'MORTGAGE_ESCROW',
        paymentAccountId: _mortgage.id,
        propertyTaxEscrow: '420.00',
        propertyTaxFrequency: 'MONTHLY',
        deductible: '2500.00',
        coverageAmount: '450000.00',
        renewalDate: homeRenewal,
        notes: 'Annual premium and property taxes are paid through mortgage escrow.',
      },
      {
        userId: user.id,
        type: 'HEALTH',
        provider: 'Blue Cross',
        nickname: 'Family health plan',
        premium: '480.00',
        premiumFrequency: 'MONTHLY',
        deductible: '1500.00',
        coverageAmount: '0.00',
        notes: 'Confirm in-network providers and annual out-of-pocket maximum during enrollment.',
      },
    ],
  });
  console.log('  ✓ Created 3 insurance policies (including one upcoming renewal)');

  const estateReview = new Date();
  estateReview.setMonth(estateReview.getMonth() + 9);
  await prisma.estateDocument.createMany({
    data: [
      {
        userId: user.id,
        type: 'WILL',
        title: 'Family will',
        reviewDate: estateReview,
        notes: 'Demo record only; document contents are not stored in Wardkeep.',
      },
      {
        userId: user.id,
        type: 'FINANCIAL_POWER_OF_ATTORNEY',
        title: 'Financial power of attorney',
        reviewDate: estateReview,
      },
    ],
  });
  console.log('  ✓ Created 2 estate-planning reminder records');

  const incomeReview = new Date();
  incomeReview.setMonth(incomeReview.getMonth() + 6);
  const nextIncome = new Date();
  nextIncome.setDate(nextIncome.getDate() + 7);
  await prisma.incomeSource.create({
    data: {
      userId: user.id,
      name: 'Primary employment',
      kind: 'EMPLOYMENT',
      frequency: 'SEMI_MONTHLY',
      expectedNetAmount: '4250.00',
      nextExpectedDate: nextIncome,
      reviewDate: incomeReview,
      notes: 'Demo planning context only; this record does not predict future income.',
    },
  });
  console.log('  ✓ Created 1 income-source planning record');

  const dependentReview = new Date();
  dependentReview.setMonth(dependentReview.getMonth() + 6);
  await prisma.dependent.create({
    data: {
      userId: user.id,
      label: 'Child',
      relationship: 'CHILD',
      reviewDate: dependentReview,
      notes: 'Demo planning record; no identifying details are stored.',
    },
  });

  const externalCommitmentReview = new Date();
  externalCommitmentReview.setMonth(externalCommitmentReview.getMonth() + 3);
  await prisma.householdObligation.createMany({
    data: [
      {
        userId: user.id,
        name: 'External grocery-account funding',
        monthlyAmount: '1000.00',
        notes:
          'Demo: monthly transfer to a household grocery account that Wardkeep does not track. Do not also record these grocery purchases in Wardkeep.',
      },
      {
        userId: user.id,
        name: 'Family support contribution',
        monthlyAmount: '250.00',
        isVariable: true,
        reviewDate: externalCommitmentReview,
        notes: 'Demo: a household-entered variable estimate, not a transaction-derived expense.',
      },
    ],
  });

  const propertyTaxDue = new Date();
  propertyTaxDue.setDate(propertyTaxDue.getDate() + 18);
  const vehicleRegistrationDue = new Date();
  vehicleRegistrationDue.setMonth(vehicleRegistrationDue.getMonth() + 3);
  await prisma.plannedExpense.createMany({
    data: [
      {
        userId: user.id,
        name: 'Property tax installment',
        amount: '1800.00',
        fundedAmount: '600.00',
        dueDate: propertyTaxDue,
        notes: 'Demo: intentionally partially funded to exercise Preparation shortfall behavior.',
      },
      {
        userId: user.id,
        name: 'Vehicle registration',
        amount: '420.00',
        fundedAmount: '420.00',
        dueDate: vehicleRegistrationDue,
      },
    ],
  });

  const vacationGoalDate = new Date();
  vacationGoalDate.setDate(vacationGoalDate.getDate() + 45);
  await prisma.financialGoal.create({
    data: {
      userId: user.id,
      name: 'Family vacation',
      targetAmount: '3000.00',
      savedAmount: '1200.00',
      targetDate: vacationGoalDate,
      notes: 'Demo: household-entered progress for an upcoming family trip.',
    },
  });
  console.log('  ✓ Created dependent, external-commitment, and planned-expense demo records');

  // Generate 6 months of transactions
  let txCount = 0;
  for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
    // Income (2 paychecks per month)
    for (let i = 0; i < 2; i++) {
      const date = randomDate(monthOffset);
      date.setDate(i === 0 ? 1 : 15);
      await prisma.transaction.create({
        data: {
          userId: user.id,
          accountId: checking.id,
          amount: '2800.00',
          type: 'CREDIT',
          date,
          merchant: 'Acme Corp Payroll',
          description: 'Bi-weekly salary',
          categoryId: categories['Income'],
        },
      });
      txCount++;
    }

    // Rent (1st of month)
    const rentDate = randomDate(monthOffset);
    rentDate.setDate(1);
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: checking.id,
        amount: '1850.00',
        type: 'DEBIT',
        date: rentDate,
        merchant: 'Apt Rent LLC',
        description: 'Monthly rent',
        categoryId: categories['Housing'],
      },
    });
    txCount++;

    // Generate 60-80 random expenses per month
    const expenseCount = Math.floor(demoRandom() * 20) + 60;
    for (let i = 0; i < expenseCount; i++) {
      const categoryName = pickRandom(Object.keys(MERCHANTS));
      const merchants = MERCHANTS[categoryName as keyof typeof MERCHANTS]!;
      const merchant = pickRandom(merchants);
      const account = demoRandom() > 0.6 ? creditCard : checking;

      let amount: number;
      switch (categoryName) {
        case 'Groceries':
          amount = randomBetween(15, 180);
          break;
        case 'Restaurants':
          amount = randomBetween(5, 65);
          break;
        case 'Transportation':
          amount = randomBetween(8, 75);
          break;
        case 'Entertainment':
          amount = randomBetween(10, 50);
          break;
        case 'Shopping':
          amount = randomBetween(15, 200);
          break;
        case 'Utilities':
          amount = randomBetween(40, 150);
          break;
        case 'Healthcare':
          amount = randomBetween(15, 250);
          break;
        case 'Housing':
          amount = randomBetween(50, 200);
          break;
        case 'Subscriptions':
          amount = randomBetween(5, 30);
          break;
        default:
          amount = randomBetween(10, 100);
      }

      await prisma.transaction.create({
        data: {
          userId: user.id,
          accountId: account.id,
          amount: amount.toFixed(2),
          type: 'DEBIT',
          date: randomDate(monthOffset),
          merchant,
          description: `Purchase at ${merchant}`,
          categoryId: categories[categoryName],
        },
      });
      txCount++;
    }
  }

  console.log(`  ✓ Created ${txCount} transactions (6 months)`);

  const reviewDates = [0, 5, 10, 15].map((minutesAgo) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() - minutesAgo);
    return date;
  });
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        amount: '42.18',
        type: 'DEBIT',
        date: reviewDates[0]!,
        merchant: 'Uncategorized Market',
        description: 'Demo transaction awaiting review',
        isReviewed: false,
      },
      {
        userId: user.id,
        accountId: creditCard.id,
        amount: '89.00',
        type: 'DEBIT',
        date: reviewDates[1]!,
        merchant: 'Home Supply Co.',
        description: 'Demo transaction awaiting review',
        isReviewed: false,
      },
      {
        userId: user.id,
        accountId: checking.id,
        amount: '18.75',
        type: 'DEBIT',
        date: reviewDates[2]!,
        merchant: 'Coffee House',
        description: 'Demo transaction awaiting review',
        isReviewed: false,
      },
      {
        userId: user.id,
        accountId: checking.id,
        amount: '125.00',
        type: 'CREDIT',
        date: reviewDates[3]!,
        merchant: 'Account Credit',
        description: 'Demo transaction awaiting review',
        isReviewed: false,
      },
    ],
  });
  console.log('  ✓ Created 4 unreviewed transaction demo records');

  const demoReturnPurchaseDate = new Date();
  demoReturnPurchaseDate.setDate(demoReturnPurchaseDate.getDate() - 12);
  const demoReturnRefundDate = new Date();
  demoReturnRefundDate.setDate(demoReturnRefundDate.getDate() - 5);
  await prisma.transaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: creditCard.id,
        amount: '64.99',
        type: 'DEBIT',
        date: demoReturnPurchaseDate,
        merchant: 'Demo Outfitters',
        description: 'Demo purchase with a matching refund',
      },
      {
        userId: user.id,
        accountId: creditCard.id,
        amount: '64.99',
        type: 'CREDIT',
        date: demoReturnRefundDate,
        merchant: 'Demo Outfitters',
        description: 'Demo refund awaiting confirmation',
      },
    ],
  });
  console.log('  ✓ Created a demo purchase/refund pair for matching verification');

  await prisma.recurringTransaction.createMany({
    data: [
      {
        userId: user.id,
        accountId: checking.id,
        merchant: 'Apt Rent LLC',
        expectedAmount: '1850.00',
        frequency: 'MONTHLY',
        nextExpected: nextMonthlyDate(1),
        isConfirmed: true,
      },
      {
        userId: user.id,
        accountId: checking.id,
        merchant: 'State Farm Insurance',
        expectedAmount: '186.00',
        frequency: 'MONTHLY',
        nextExpected: nextMonthlyDate(12),
        isConfirmed: true,
      },
      {
        userId: user.id,
        accountId: creditCard.id,
        merchant: 'Netflix',
        expectedAmount: '15.49',
        frequency: 'MONTHLY',
        nextExpected: nextMonthlyDate(21),
        isConfirmed: true,
        isSubscription: true,
      },
      {
        userId: user.id,
        accountId: creditCard.id,
        merchant: 'GitHub Pro',
        expectedAmount: '4.00',
        frequency: 'MONTHLY',
        nextExpected: nextMonthlyDate(25),
        isConfirmed: false,
      },
    ],
  });
  console.log('  ✓ Created 3 confirmed and 1 detected recurring-bill demo records');

  // Create current month budget
  const now = new Date();
  const budgetMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const budget = await prisma.budget.create({
    data: {
      userId: user.id,
      month: budgetMonth,
    },
  });

  const allocations = [
    { categoryId: categories['Groceries']!, amount: '600.00' },
    { categoryId: categories['Restaurants']!, amount: '300.00' },
    { categoryId: categories['Transportation']!, amount: '200.00' },
    { categoryId: categories['Entertainment']!, amount: '150.00' },
    { categoryId: categories['Shopping']!, amount: '250.00' },
    { categoryId: categories['Utilities']!, amount: '350.00' },
    { categoryId: categories['Healthcare']!, amount: '100.00' },
    { categoryId: categories['Housing']!, amount: '1900.00' },
    { categoryId: categories['Subscriptions']!, amount: '80.00' },
  ];

  for (const alloc of allocations) {
    await prisma.budgetAllocation.create({
      data: { budgetId: budget.id, ...alloc },
    });
  }

  console.log(`  ✓ Created budget for ${budgetMonth} with ${allocations.length} allocations`);

  // Demo-only history makes the Dashboard's 7d / 30d / 90d readiness controls
  // immediately testable. Today remains intentionally absent: the first live
  // readiness check records the current score for today.
  const snapshotHistory = Array.from({ length: 90 }, (_, index) => {
    const recordedAt = new Date();
    recordedAt.setUTCDate(recordedAt.getUTCDate() - (90 - index));
    recordedAt.setUTCHours(0, 0, 0, 0);
    const progress = Math.round((index / 89) * 8);

    return {
      userId: user.id,
      recordedAt,
      overall: 61 + progress,
      protection: 43 + progress,
      provision: 54 + progress,
      preparation: 30 + Math.round(progress / 2),
      prosperity: 72 + progress,
      peace: 52 + progress,
    };
  });
  await prisma.readinessSnapshot.createMany({ data: snapshotHistory });
  console.log('  ✓ Created 90 days of demo readiness history');

  console.log('\n✅ Demo seed complete!');
  console.log(`   Login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
