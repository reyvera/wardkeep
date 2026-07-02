import { z } from 'zod';

import { RuleLogic, RuleConditionField, RuleOperator, RuleActionType } from '@wardkeep/shared';

const ConditionSchema = z.object({
  field: z.nativeEnum(RuleConditionField),
  operator: z.nativeEnum(RuleOperator),
  value: z.string().min(1).max(500),
});

const ActionSchema = z.object({
  type: z.nativeEnum(RuleActionType),
  value: z.string().min(1).max(500),
});

export const CreateRuleSchema = z.object({
  name: z.string().min(1).max(100),
  priority: z.number().int().positive().optional(),
  isActive: z.boolean().optional().default(true),
  logic: z.nativeEnum(RuleLogic).optional().default(RuleLogic.ALL),
  conditions: z.array(ConditionSchema).min(1, 'At least one condition is required'),
  actions: z.array(ActionSchema).min(1, 'At least one action is required'),
});
export type CreateRuleDto = z.infer<typeof CreateRuleSchema>;

export const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  priority: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  logic: z.nativeEnum(RuleLogic).optional(),
  conditions: z.array(ConditionSchema).min(1).optional(),
  actions: z.array(ActionSchema).min(1).optional(),
});
export type UpdateRuleDto = z.infer<typeof UpdateRuleSchema>;
