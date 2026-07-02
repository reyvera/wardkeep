import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  RuleActionType,
  RuleConditionField,
  RuleLogic,
  RuleOperator,
} from '@wardkeep/shared';

import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/create-rule.dto';
import { evaluateRule, EvalCondition, EvalTransaction } from './rules-evaluator';

/** Result of applying actions to a transaction. */
export interface AppliedActions {
  categoryId?: string;
  merchant?: string;
  tags: string[];
  notes: string[];
}

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all rules for a user, sorted by priority ascending.
   * @param userId - The authenticated user's ID
   * @returns Array of rules with conditions and actions
   */
  async listRules(userId: string) {
    const rules = await this.prisma.rule.findMany({
      where: { userId },
      include: { conditions: true, actions: true },
      orderBy: { priority: 'asc' },
    });

    return rules.map((rule) => this.formatRule(rule));
  }

  /**
   * Creates a new rule for the user.
   * Validates regex conditions and verifies referenced categories exist.
   * Auto-assigns priority if not specified.
   * @param userId - The authenticated user's ID
   * @param dto - The rule creation data
   * @returns The newly created rule
   * @throws BadRequestException if regex is invalid or category does not exist
   */
  async createRule(userId: string, dto: CreateRuleDto) {
    await this.validateConditions(dto.conditions);
    await this.validateActions(userId, dto.actions);

    const priority = dto.priority ?? (await this.getNextPriority(userId));

    const rule = await this.prisma.rule.create({
      data: {
        userId,
        name: dto.name,
        priority,
        isActive: dto.isActive,
        logic: dto.logic,
        conditions: {
          create: dto.conditions.map((c: { field: string; operator: string; value: string }) => ({
            field: c.field as RuleConditionField,
            operator: c.operator as RuleOperator,
            value: c.value,
          })),
        },
        actions: {
          create: dto.actions.map((a: { type: string; value: string }) => ({
            type: a.type as RuleActionType,
            value: a.value,
          })),
        },
      },
      include: { conditions: true, actions: true },
    });

    return this.formatRule(rule);
  }

  /**
   * Updates an existing rule for the user.
   * If conditions or actions are provided, replaces them entirely.
   * @param userId - The authenticated user's ID
   * @param ruleId - The rule ID to update
   * @param dto - The fields to update
   * @returns The updated rule
   * @throws NotFoundException if the rule does not belong to the user
   * @throws BadRequestException if regex is invalid or category does not exist
   */
  async updateRule(userId: string, ruleId: string, dto: UpdateRuleDto) {
    const existing = await this.prisma.rule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Rule not found');
    }

    if (dto.conditions) {
      await this.validateConditions(dto.conditions);
    }
    if (dto.actions) {
      await this.validateActions(userId, dto.actions);
    }

    const rule = await this.prisma.$transaction(async (tx) => {
      if (dto.conditions) {
        await tx.ruleCondition.deleteMany({ where: { ruleId } });
        await tx.ruleCondition.createMany({
          data: dto.conditions.map((c: { field: string; operator: string; value: string }) => ({
            ruleId,
            field: c.field as RuleConditionField,
            operator: c.operator as RuleOperator,
            value: c.value,
          })),
        });
      }

      if (dto.actions) {
        await tx.ruleAction.deleteMany({ where: { ruleId } });
        await tx.ruleAction.createMany({
          data: dto.actions.map((a: { type: string; value: string }) => ({
            ruleId,
            type: a.type as RuleActionType,
            value: a.value,
          })),
        });
      }

      return tx.rule.update({
        where: { id: ruleId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          ...(dto.logic !== undefined && { logic: dto.logic }),
        },
        include: { conditions: true, actions: true },
      });
    });

    return this.formatRule(rule);
  }

  /**
   * Deletes a rule belonging to the user.
   * Cascade delete removes associated conditions and actions.
   * @param userId - The authenticated user's ID
   * @param ruleId - The rule ID to delete
   * @throws NotFoundException if the rule does not belong to the user
   */
  async deleteRule(userId: string, ruleId: string): Promise<void> {
    const existing = await this.prisma.rule.findFirst({
      where: { id: ruleId, userId },
    });
    if (!existing) {
      throw new NotFoundException('Rule not found');
    }

    await this.prisma.rule.delete({ where: { id: ruleId } });
  }

  /**
   * Dry-runs a rule against all user transactions, returning matches without modification.
   * @param userId - The authenticated user's ID
   * @param ruleId - The rule ID to dry-run
   * @returns Array of matching transactions
   * @throws NotFoundException if the rule does not belong to the user
   */
  async dryRun(userId: string, ruleId: string) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, userId },
      include: { conditions: true, actions: true },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      include: { tags: true },
    });

    const conditions: EvalCondition[] = rule.conditions.map((c) => ({
      field: c.field as unknown as RuleConditionField,
      operator: c.operator as unknown as RuleOperator,
      value: c.value,
    }));

    const matching = transactions.filter((tx) => {
      const evalTx: EvalTransaction = {
        merchant: tx.merchant,
        amount: tx.amount.toString(),
        description: tx.description,
      };
      return evaluateRule(conditions, rule.logic as unknown as RuleLogic, evalTx);
    });

    return matching.map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      date: tx.date,
      amount: tx.amount.toString(),
      type: tx.type,
      merchant: tx.merchant,
      description: tx.description,
      categoryId: tx.categoryId,
      notes: tx.notes,
      tags: tx.tags.map((t) => t.tag),
    }));
  }

  /**
   * Applies a rule retroactively to all matching user transactions.
   * Modifies matching transactions according to the rule's actions.
   * @param userId - The authenticated user's ID
   * @param ruleId - The rule ID to apply
   * @returns Object with the count of affected transactions
   * @throws NotFoundException if the rule does not belong to the user
   */
  async applyRule(userId: string, ruleId: string) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, userId },
      include: { conditions: true, actions: true },
    });
    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      include: { tags: true },
    });

    const conditions: EvalCondition[] = rule.conditions.map((c) => ({
      field: c.field as unknown as RuleConditionField,
      operator: c.operator as unknown as RuleOperator,
      value: c.value,
    }));

    const matching = transactions.filter((tx) => {
      const evalTx: EvalTransaction = {
        merchant: tx.merchant,
        amount: tx.amount.toString(),
        description: tx.description,
      };
      return evaluateRule(conditions, rule.logic as unknown as RuleLogic, evalTx);
    });

    let affectedCount = 0;

    for (const tx of matching) {
      const applied = this.resolveActions(rule.actions);
      await this.applyActionsToTransaction(tx.id, applied, tx.tags.map((t) => t.tag));
      affectedCount++;
    }

    return { affectedCount };
  }

  /**
   * Evaluates all active rules in priority order against a transaction and applies actions.
   * Uses conflict resolution: last-matching wins for SET fields, accumulate for ADD fields.
   * @param userId - The authenticated user's ID
   * @param transaction - The transaction to evaluate rules against
   * @returns The applied actions or null if no rules matched
   */
  async applyRulesToTransaction(
    userId: string,
    transaction: EvalTransaction & { id: string; tags?: string[] },
  ): Promise<AppliedActions | null> {
    const rules = await this.prisma.rule.findMany({
      where: { userId, isActive: true },
      include: { conditions: true, actions: true },
      orderBy: { priority: 'asc' },
    });

    if (rules.length === 0) return null;

    const result: AppliedActions = { tags: [], notes: [] };
    let hasMatch = false;

    for (const rule of rules) {
      const conditions: EvalCondition[] = rule.conditions.map((c) => ({
        field: c.field as unknown as RuleConditionField,
        operator: c.operator as unknown as RuleOperator,
        value: c.value,
      }));

      if (evaluateRule(conditions, rule.logic as unknown as RuleLogic, transaction)) {
        hasMatch = true;

        for (const action of rule.actions) {
          switch (action.type as string) {
            case RuleActionType.SET_CATEGORY:
              result.categoryId = action.value;
              break;
            case RuleActionType.SET_MERCHANT:
              result.merchant = action.value;
              break;
            case RuleActionType.ADD_TAG:
              if (!result.tags.includes(action.value)) {
                result.tags.push(action.value);
              }
              break;
            case RuleActionType.ADD_NOTE:
              result.notes.push(action.value);
              break;
          }
        }
      }
    }

    if (!hasMatch) return null;

    await this.applyActionsToTransaction(
      transaction.id,
      result,
      transaction.tags ?? [],
    );

    return result;
  }

  /**
   * Validates regex conditions by attempting to compile the regex.
   * @param conditions - The conditions to validate
   * @throws BadRequestException if any regex condition has an invalid pattern
   */
  private async validateConditions(
    conditions: { field: string; operator: string; value: string }[],
  ): Promise<void> {
    for (const condition of conditions) {
      if (condition.operator === 'REGEX') {
        try {
          new RegExp(condition.value);
        } catch {
          throw new BadRequestException(
            `Invalid regex pattern: "${condition.value}"`,
          );
        }
      }
    }
  }

  /**
   * Validates actions by checking that referenced categories exist for the user.
   * @param userId - The authenticated user's ID
   * @param actions - The actions to validate
   * @throws BadRequestException if a SET_CATEGORY references a nonexistent category
   */
  private async validateActions(
    userId: string,
    actions: { type: string; value: string }[],
  ): Promise<void> {
    for (const action of actions) {
      if (action.type === RuleActionType.SET_CATEGORY) {
        const category = await this.prisma.category.findFirst({
          where: { id: action.value, userId },
        });
        if (!category) {
          throw new BadRequestException(
            `Category not found: "${action.value}"`,
          );
        }
      }
    }
  }

  /**
   * Computes the next available priority for a user's rules.
   * @param userId - The authenticated user's ID
   * @returns The next priority number (max existing + 1, or 1 if no rules exist)
   */
  private async getNextPriority(userId: string): Promise<number> {
    const maxRule = await this.prisma.rule.findFirst({
      where: { userId },
      orderBy: { priority: 'desc' },
      select: { priority: true },
    });
    return (maxRule?.priority ?? 0) + 1;
  }

  /**
   * Resolves actions from a rule into an AppliedActions structure.
   * @param actions - The rule actions to resolve
   * @returns The resolved applied actions
   */
  private resolveActions(
    actions: { type: string; value: string }[],
  ): AppliedActions {
    const result: AppliedActions = { tags: [], notes: [] };

    for (const action of actions) {
      switch (action.type as string) {
        case RuleActionType.SET_CATEGORY:
          result.categoryId = action.value;
          break;
        case RuleActionType.SET_MERCHANT:
          result.merchant = action.value;
          break;
        case RuleActionType.ADD_TAG:
          if (!result.tags.includes(action.value)) {
            result.tags.push(action.value);
          }
          break;
        case RuleActionType.ADD_NOTE:
          result.notes.push(action.value);
          break;
      }
    }

    return result;
  }

  /**
   * Applies resolved actions to a transaction in the database.
   * @param transactionId - The transaction ID to update
   * @param actions - The resolved actions to apply
   * @param existingTags - The existing tags on the transaction
   */
  private async applyActionsToTransaction(
    transactionId: string,
    actions: AppliedActions,
    existingTags: string[],
  ): Promise<void> {
    const updateData: Record<string, unknown> = {};

    if (actions.categoryId) {
      updateData.categoryId = actions.categoryId;
    }
    if (actions.merchant) {
      updateData.merchant = actions.merchant;
    }
    if (actions.notes.length > 0) {
      updateData.notes = actions.notes.join('; ');
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.transaction.update({
        where: { id: transactionId },
        data: updateData,
      });
    }

    if (actions.tags.length > 0) {
      const newTags = actions.tags.filter((t) => !existingTags.includes(t));
      if (newTags.length > 0) {
        await this.prisma.transactionTag.createMany({
          data: newTags.map((tag) => ({ transactionId, tag })),
          skipDuplicates: true,
        });
      }
    }
  }

  /**
   * Formats a rule from Prisma for the API response.
   * @param rule - The raw rule from the database
   * @returns Formatted rule object
   */
  private formatRule(rule: {
    id: string;
    userId: string;
    name: string;
    priority: number;
    isActive: boolean;
    logic: string;
    createdAt: Date;
    updatedAt: Date;
    conditions: { id: string; ruleId: string; field: string; operator: string; value: string }[];
    actions: { id: string; ruleId: string; type: string; value: string }[];
  }) {
    return {
      id: rule.id,
      userId: rule.userId,
      name: rule.name,
      priority: rule.priority,
      isActive: rule.isActive,
      logic: rule.logic,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      conditions: rule.conditions.map((c) => ({
        id: c.id,
        ruleId: c.ruleId,
        field: c.field,
        operator: c.operator,
        value: c.value,
      })),
      actions: rule.actions.map((a) => ({
        id: a.id,
        ruleId: a.ruleId,
        type: a.type,
        value: a.value,
      })),
    };
  }
}
