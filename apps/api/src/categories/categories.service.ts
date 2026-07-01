import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MAX_CATEGORIES_PER_USER } from '@budgetapp/shared';

import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lists all categories for a user as a tree structure.
   * Top-level categories include their children nested inside.
   * @param userId - The authenticated user's ID
   * @returns Array of top-level categories with nested children
   */
  async listCategories(userId: string) {
    const categories = await this.prisma.category.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    const topLevel = categories.filter((c) => c.parentId === null);
    const children = categories.filter((c) => c.parentId !== null);

    return topLevel.map((parent) => ({
      ...parent,
      children: children.filter((child) => child.parentId === parent.id),
    }));
  }

  /**
   * Creates a new category for the user.
   * Enforces max category limit and single-level nesting constraint.
   * @param userId - The authenticated user's ID
   * @param dto - The category creation data
   * @returns The newly created category
   * @throws BadRequestException if category limit reached or nesting too deep
   * @throws NotFoundException if parentId references non-existent category
   * @throws ConflictException if name conflicts within same parent scope
   */
  async createCategory(userId: string, dto: CreateCategoryDto) {
    const count = await this.prisma.category.count({ where: { userId } });
    if (count >= MAX_CATEGORIES_PER_USER) {
      throw new BadRequestException(
        `Maximum of ${MAX_CATEGORIES_PER_USER} categories allowed per user`,
      );
    }

    if (dto.parentId) {
      const parent = await this.prisma.category.findFirst({
        where: { id: dto.parentId, userId },
      });
      if (!parent) {
        throw new NotFoundException('Parent category not found');
      }
      if (parent.parentId !== null) {
        throw new BadRequestException(
          'Cannot create sub-category under another sub-category (max depth is 2)',
        );
      }
    }

    try {
      const category = await this.prisma.category.create({
        data: {
          userId,
          name: dto.name,
          parentId: dto.parentId ?? null,
          icon: dto.icon ?? null,
          color: dto.color ?? null,
        },
      });
      return category;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A category with this name already exists in this scope');
      }
      throw error;
    }
  }

  /**
   * Updates an existing category for the user.
   * @param userId - The authenticated user's ID
   * @param categoryId - The category ID to update
   * @param dto - The fields to update
   * @returns The updated category
   * @throws NotFoundException if category does not exist or belongs to another user
   * @throws ConflictException if the new name conflicts with an existing category
   */
  async updateCategory(userId: string, categoryId: string, dto: UpdateCategoryDto) {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    try {
      const updated = await this.prisma.category.update({
        where: { id: categoryId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.color !== undefined && { color: dto.color }),
        },
      });
      return updated;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A category with this name already exists in this scope');
      }
      throw error;
    }
  }

  /**
   * Deletes a category and reassigns its transactions to Uncategorized.
   * If the category is a parent, also deletes its children after reassigning their transactions.
   * @param userId - The authenticated user's ID
   * @param categoryId - The category ID to delete
   * @throws NotFoundException if category does not exist or belongs to another user
   * @throws BadRequestException if attempting to delete the Uncategorized category
   */
  async deleteCategory(userId: string, categoryId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    if (category.isDefault && category.name === 'Uncategorized') {
      throw new BadRequestException('Cannot delete the Uncategorized category');
    }

    const uncategorized = await this.prisma.category.findFirst({
      where: { userId, name: 'Uncategorized', isDefault: true },
    });
    if (!uncategorized) {
      throw new NotFoundException('Uncategorized category not found for user');
    }

    await this.prisma.$transaction(async (tx) => {
      // Reassign transactions from this category to Uncategorized
      await tx.transaction.updateMany({
        where: { categoryId, userId },
        data: { categoryId: uncategorized.id },
      });

      // If this is a parent category, handle children
      const children = await tx.category.findMany({
        where: { parentId: categoryId, userId },
      });

      if (children.length > 0) {
        const childIds = children.map((c) => c.id);

        // Reassign all children's transactions to Uncategorized
        await tx.transaction.updateMany({
          where: { categoryId: { in: childIds }, userId },
          data: { categoryId: uncategorized.id },
        });

        // Delete children
        await tx.category.deleteMany({
          where: { id: { in: childIds } },
        });
      }

      // Delete the category itself
      await tx.category.delete({
        where: { id: categoryId },
      });
    });
  }

  /**
   * Merges source category into target by reassigning all transactions.
   * Also handles source's children's transactions before deleting source and its children.
   * @param userId - The authenticated user's ID
   * @param sourceId - The category to merge from (will be deleted)
   * @param targetId - The category to merge into (receives transactions)
   * @throws NotFoundException if either category does not exist or belongs to another user
   * @throws BadRequestException if source is the Uncategorized category or source equals target
   */
  async mergeCategories(userId: string, sourceId: string, targetId: string): Promise<void> {
    if (sourceId === targetId) {
      throw new BadRequestException('Source and target categories must be different');
    }

    const source = await this.prisma.category.findFirst({
      where: { id: sourceId, userId },
    });
    if (!source) {
      throw new NotFoundException('Source category not found');
    }

    if (source.isDefault && source.name === 'Uncategorized') {
      throw new BadRequestException('Cannot merge the Uncategorized category as source');
    }

    const target = await this.prisma.category.findFirst({
      where: { id: targetId, userId },
    });
    if (!target) {
      throw new NotFoundException('Target category not found');
    }

    await this.prisma.$transaction(async (tx) => {
      // Reassign source's transactions to target
      await tx.transaction.updateMany({
        where: { categoryId: sourceId, userId },
        data: { categoryId: targetId },
      });

      // Handle source's children
      const children = await tx.category.findMany({
        where: { parentId: sourceId, userId },
      });

      if (children.length > 0) {
        const childIds = children.map((c) => c.id);

        // Reassign children's transactions to target
        await tx.transaction.updateMany({
          where: { categoryId: { in: childIds }, userId },
          data: { categoryId: targetId },
        });

        // Delete children
        await tx.category.deleteMany({
          where: { id: { in: childIds } },
        });
      }

      // Delete source
      await tx.category.delete({
        where: { id: sourceId },
      });
    });
  }
}
