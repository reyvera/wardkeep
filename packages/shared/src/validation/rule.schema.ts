/**
 * Rule validation schemas.
 */
import { z } from 'zod';

import { RuleActionType, RuleConditionField, RuleLogic, RuleOperator } from '../types/rule';
import { DESCRIPTION_MAX_LENGTH } from '../constants/limits';

/** Schema for a rule condition. */
const RuleConditionSchema = z.object({
  field: z.nativeEnum(RuleConditionField),
  operator: z.nativeEnum(RuleOperator),
  value: z.string().min(1).max(DESCRIPTION_MAX_LENGTH),
});

/** Schema for a rule action. */
const RuleActionSchema = z.object({
  type: z.nativeEnum(RuleActionType),
  value: z.string().min(1).max(DESCRIPTION_MAX_LENGTH),
});

/** Schema for creating a new rule. */
export const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  priority: z.number().int().min(0),
  logic: z.nativeEnum(RuleLogic).default(RuleLogic.ALL),
  conditions: z.array(RuleConditionSchema).min(1),
  actions: z.array(RuleActionSchema).min(1),
});

/** Schema for updating an existing rule. */
export const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  priority: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  logic: z.nativeEnum(RuleLogic).optional(),
  conditions: z.array(RuleConditionSchema).min(1).optional(),
  actions: z.array(RuleActionSchema).min(1).optional(),
});

export type CreateRuleInput = z.infer<typeof CreateRuleSchema>;
export type UpdateRuleInput = z.infer<typeof UpdateRuleSchema>;
