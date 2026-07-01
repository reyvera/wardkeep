import { Injectable } from '@nestjs/common';
import { Decimal } from 'decimal.js';

import {
  calculatePayoffSchedule,
  compareStrategies,
  Debt,
  PayoffStrategy,
} from '@budgetapp/finance-engine';

import { CalculateDebtDto, CompareDebtDto } from './dto/calculate-debt.dto';

@Injectable()
export class DebtService {
  /**
   * Calculates a debt payoff schedule for the given debts and strategy.
   * Delegates to the finance engine and serializes Decimal results.
   * @param dto - The debts, strategy, and total monthly payment
   * @returns Serialized payoff schedule with string amounts
   */
  calculate(dto: CalculateDebtDto) {
    const debts: Debt[] = dto.debts.map((d: CalculateDebtDto['debts'][number]) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = calculatePayoffSchedule(
      debts,
      dto.strategy as PayoffStrategy,
      new Decimal(dto.totalMonthlyPayment),
    );

    return this.serializePayoffResult(result);
  }

  /**
   * Compares multiple debt payoff strategies for the given debts.
   * Delegates to the finance engine and serializes Decimal results.
   * @param dto - The debts, strategies to compare, and total monthly payment
   * @returns Serialized comparison results with string amounts
   */
  compare(dto: CompareDebtDto) {
    const debts: Debt[] = dto.debts.map((d: CompareDebtDto['debts'][number]) => ({
      id: d.id,
      name: d.name,
      balance: d.balance,
      apr: d.apr,
      minimumPayment: d.minimumPayment,
      priority: d.priority,
    }));

    const result = compareStrategies(
      debts,
      dto.strategies as PayoffStrategy[],
      new Decimal(dto.totalMonthlyPayment),
    );

    return {
      strategies: result.strategies.map((s) => ({
        strategy: s.strategy,
        result: this.serializePayoffResult(s.result),
      })),
      interestSavings: result.interestSavings.toFixed(2),
      timeSavings: result.timeSavings,
    };
  }

  /**
   * Runs a what-if simulation (same as calculate, pure function with no side effects).
   * @param dto - The debts, strategy, and total monthly payment
   * @returns Serialized payoff schedule with string amounts
   */
  whatIf(dto: CalculateDebtDto) {
    return this.calculate(dto);
  }

  /**
   * Serializes a PayoffResult, converting all Decimal values to fixed-point strings.
   * @param result - The raw payoff result from the finance engine
   * @returns Object with all Decimal values converted to strings
   */
  private serializePayoffResult(result: {
    schedules: Array<{
      debtId: string;
      debtName: string;
      months: Array<{
        month: number;
        debtId: string;
        payment: Decimal;
        principal: Decimal;
        interest: Decimal;
        remainingBalance: Decimal;
      }>;
      totalInterest: Decimal;
      totalPaid: Decimal;
      payoffMonth: number;
    }>;
    totalInterest: Decimal;
    totalMonths: number;
    debtFreeDate: number;
    warning?: string;
  }) {
    return {
      schedules: result.schedules.map((s) => ({
        debtId: s.debtId,
        debtName: s.debtName,
        months: s.months.map((m) => ({
          month: m.month,
          debtId: m.debtId,
          payment: m.payment.toFixed(2),
          principal: m.principal.toFixed(2),
          interest: m.interest.toFixed(2),
          remainingBalance: m.remainingBalance.toFixed(2),
        })),
        totalInterest: s.totalInterest.toFixed(2),
        totalPaid: s.totalPaid.toFixed(2),
        payoffMonth: s.payoffMonth,
      })),
      totalInterest: result.totalInterest.toFixed(2),
      totalMonths: result.totalMonths,
      debtFreeDate: result.debtFreeDate,
      ...(result.warning && { warning: result.warning }),
    };
  }
}
