import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { SettingsService } from './settings.service';
import { UpdateSettingsSchema, ValidateApiKeySchema } from './dto/update-settings.dto';

@Controller('settings')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Retrieves the current user's settings.
   * API keys are masked for security.
   * @param req - The scoped request with userId
   * @returns The user's settings with masked API keys
   */
  @Get()
  async getSettings(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.settingsService.getSettings(userId);
  }

  /**
   * Updates the current user's settings.
   * @param req - The scoped request with userId and body
   * @returns The updated settings with masked API keys
   */
  @Patch()
  async updateSettings(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = UpdateSettingsSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.settingsService.updateSettings(userId, result.data);
  }

  /**
   * Validates an API key format for the given provider.
   * Does not store the key — only checks format validity.
   * @param req - The scoped request with body containing provider and apiKey
   * @returns Object with valid boolean and optional error message
   */
  @Post('validate-api-key')
  @HttpCode(HttpStatus.OK)
  async validateApiKey(@Req() req: ScopedRequest) {
    const result = ValidateApiKeySchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.settingsService.validateApiKey(result.data.provider, result.data.apiKey);
  }
}
