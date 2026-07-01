import { RuleConditionField, RuleOperator, RuleLogic } from '@budgetapp/shared';

/** A condition to evaluate against a transaction. */
export interface EvalCondition {
  field: RuleConditionField;
  operator: RuleOperator;
  value: string;
}

/** Minimal transaction shape needed for rule evaluation. */
export interface EvalTransaction {
  merchant: string | null;
  amount: string;
  description: string | null;
}

/**
 * Evaluates a single condition against a transaction.
 * @param condition - The condition to evaluate
 * @param tx - The transaction to evaluate against
 * @returns true if the condition matches the transaction
 */
export function evaluateCondition(condition: EvalCondition, tx: EvalTransaction): boolean {
  const fieldValue = getFieldValue(condition.field, tx);

  switch (condition.operator) {
    case RuleOperator.CONTAINS:
      return fieldValue !== null && fieldValue.toLowerCase().includes(condition.value.toLowerCase());
    case RuleOperator.EQUALS:
      if (condition.field === RuleConditionField.AMOUNT) {
        return parseFloat(tx.amount) === parseFloat(condition.value);
      }
      return fieldValue !== null && fieldValue.toLowerCase() === condition.value.toLowerCase();
    case RuleOperator.STARTS_WITH:
      return (
        fieldValue !== null && fieldValue.toLowerCase().startsWith(condition.value.toLowerCase())
      );
    case RuleOperator.REGEX:
      if (fieldValue === null) return false;
      try {
        return new RegExp(condition.value, 'i').test(fieldValue);
      } catch {
        return false;
      }
    case RuleOperator.GREATER_THAN:
      return parseFloat(tx.amount) > parseFloat(condition.value);
    case RuleOperator.LESS_THAN:
      return parseFloat(tx.amount) < parseFloat(condition.value);
    case RuleOperator.BETWEEN: {
      const parts = condition.value.split(',').map((v) => parseFloat(v.trim()));
      const min = parts[0];
      const max = parts[1];
      if (min === undefined || max === undefined || isNaN(min) || isNaN(max)) return false;
      const amt = parseFloat(tx.amount);
      return amt >= min && amt <= max;
    }
  }
}

/**
 * Extracts the appropriate field value from a transaction for condition evaluation.
 * @param field - The field to extract
 * @param tx - The transaction to extract from
 * @returns The field value or null
 */
function getFieldValue(field: RuleConditionField, tx: EvalTransaction): string | null {
  switch (field) {
    case RuleConditionField.MERCHANT:
      return tx.merchant;
    case RuleConditionField.AMOUNT:
      return tx.amount;
    case RuleConditionField.DESCRIPTION:
      return tx.description;
  }
}

/**
 * Evaluates whether a set of conditions match a transaction based on the logic mode.
 * @param conditions - The conditions to evaluate
 * @param logic - ALL (AND) or ANY (OR) logic
 * @param tx - The transaction to evaluate against
 * @returns true if the rule matches the transaction
 */
export function evaluateRule(
  conditions: EvalCondition[],
  logic: RuleLogic,
  tx: EvalTransaction,
): boolean {
  if (logic === RuleLogic.ALL) {
    return conditions.every((c) => evaluateCondition(c, tx));
  }
  return conditions.some((c) => evaluateCondition(c, tx));
}
