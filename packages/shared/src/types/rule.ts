/**
 * Rule domain types and enums.
 */

/** How multiple conditions are combined. */
export enum RuleLogic {
  ALL = 'ALL',
  ANY = 'ANY',
}

/** Fields that a rule condition can target. */
export enum RuleConditionField {
  MERCHANT = 'MERCHANT',
  AMOUNT = 'AMOUNT',
  DESCRIPTION = 'DESCRIPTION',
}

/** Operators for rule condition evaluation. */
export enum RuleOperator {
  CONTAINS = 'CONTAINS',
  EQUALS = 'EQUALS',
  STARTS_WITH = 'STARTS_WITH',
  REGEX = 'REGEX',
  GREATER_THAN = 'GREATER_THAN',
  LESS_THAN = 'LESS_THAN',
  BETWEEN = 'BETWEEN',
}

/** Action types a rule can execute. */
export enum RuleActionType {
  SET_CATEGORY = 'SET_CATEGORY',
  ADD_TAG = 'ADD_TAG',
  SET_MERCHANT = 'SET_MERCHANT',
  ADD_NOTE = 'ADD_NOTE',
}

/** A condition within a rule. */
export interface RuleCondition {
  id: string;
  ruleId: string;
  field: RuleConditionField;
  operator: RuleOperator;
  value: string;
}

/** An action taken when a rule matches. */
export interface RuleAction {
  id: string;
  ruleId: string;
  type: RuleActionType;
  value: string;
}

/** Rule entity matching Prisma schema. */
export interface Rule {
  id: string;
  userId: string;
  name: string;
  priority: number;
  isActive: boolean;
  logic: RuleLogic;
  createdAt: Date;
  updatedAt: Date;
  conditions?: RuleCondition[];
  actions?: RuleAction[];
}
