import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import {
  UserScopeInterceptor,
  ScopedRequest,
} from '../common/interceptors/user-scope.interceptor';
import { CategoriesService } from './categories.service';
import { CreateCategorySchema, MergeCategoriesSchema } from './dto/create-category.dto';
import { UpdateCategorySchema } from './dto/update-category.dto';

@Controller('categories')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  /**
   * Lists all categories for the authenticated user as a tree structure.
   * @param req - The scoped request with userId
   * @returns Array of top-level categories with nested children
   */
  @Get()
  async listCategories(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.categoriesService.listCategories(userId);
  }

  /**
   * Merges source category into target category.
   * Must be placed before :id routes to avoid route conflicts.
   * @param req - The scoped request with userId and body
   * @returns void (204 No Content)
   */
  @Post('merge')
  @HttpCode(HttpStatus.NO_CONTENT)
  async mergeCategories(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = MergeCategoriesSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    await this.categoriesService.mergeCategories(userId, result.data.sourceId, result.data.targetId);
  }

  /**
   * Creates a new category for the authenticated user.
   * @param req - The scoped request with userId and body
   * @returns The newly created category
   */
  @Post()
  async createCategory(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CreateCategorySchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.categoriesService.createCategory(userId, result.data);
  }

  /**
   * Updates an existing category for the authenticated user.
   * @param req - The scoped request with userId and body
   * @param id - The category ID from route params
   * @returns The updated category
   */
  @Patch(':id')
  async updateCategory(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    const result = UpdateCategorySchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.categoriesService.updateCategory(userId, id, result.data);
  }

  /**
   * Deletes a category and reassigns its transactions to Uncategorized.
   * @param req - The scoped request with userId
   * @param id - The category ID from route params
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCategory(@Req() req: ScopedRequest, @Param('id') id: string) {
    const userId = req.userId!;
    await this.categoriesService.deleteCategory(userId, id);
  }
}
