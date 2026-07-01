import { BadRequestException, Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

/**
 * Service managing user settings including AI privacy mode,
 * encrypted API keys, backup schedule, and session configuration.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Retrieves or creates default settings for a user.
   * API keys are masked to show only the last 4 characters.
   * @param userId - The authenticated user's ID
   * @returns The user's settings with masked API keys
   */
  async getSettings(userId: string) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    return {
      id: settings.id,
      userId: settings.userId,
      aiPrivacyMode: settings.aiPrivacyMode,
      openaiKey: this.maskKey(settings.openaiKey),
      anthropicKey: this.maskKey(settings.anthropicKey),
      backupSchedule: settings.backupSchedule,
      backupRetention: settings.backupRetention,
      sessionTimeout: settings.sessionTimeout,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Updates user settings. Encrypts API keys before storage.
   * Null values clear the stored key.
   * @param userId - The authenticated user's ID
   * @param dto - The settings fields to update
   * @returns The updated settings with masked API keys
   */
  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    // Ensure the settings record exists
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });

    const data: Record<string, unknown> = {};

    if (dto.aiPrivacyMode !== undefined) {
      data.aiPrivacyMode = dto.aiPrivacyMode;
    }

    if (dto.openaiKey !== undefined) {
      data.openaiKey = dto.openaiKey ? this.encryption.encrypt(dto.openaiKey) : null;
    }

    if (dto.anthropicKey !== undefined) {
      data.anthropicKey = dto.anthropicKey ? this.encryption.encrypt(dto.anthropicKey) : null;
    }

    if (dto.backupSchedule !== undefined) {
      data.backupSchedule = dto.backupSchedule;
    }

    if (dto.backupRetention !== undefined) {
      data.backupRetention = dto.backupRetention;
    }

    if (dto.sessionTimeout !== undefined) {
      data.sessionTimeout = dto.sessionTimeout;
    }

    const settings = await this.prisma.userSettings.update({
      where: { userId },
      data,
    });

    return {
      id: settings.id,
      userId: settings.userId,
      aiPrivacyMode: settings.aiPrivacyMode,
      openaiKey: this.maskKey(settings.openaiKey),
      anthropicKey: this.maskKey(settings.anthropicKey),
      backupSchedule: settings.backupSchedule,
      backupRetention: settings.backupRetention,
      sessionTimeout: settings.sessionTimeout,
      createdAt: settings.createdAt,
      updatedAt: settings.updatedAt,
    };
  }

  /**
   * Validates an API key format based on the provider.
   * OpenAI keys must start with "sk-", Anthropic keys with "sk-ant-".
   * @param provider - The AI provider ('openai' | 'anthropic')
   * @param apiKey - The API key to validate
   * @returns Object with valid boolean and optional error message
   */
  validateApiKey(provider: 'openai' | 'anthropic', apiKey: string): { valid: boolean; error?: string } {
    if (provider === 'openai') {
      if (!apiKey.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API key must start with "sk-"' };
      }
      return { valid: true };
    }

    if (provider === 'anthropic') {
      if (!apiKey.startsWith('sk-ant-')) {
        return { valid: false, error: 'Anthropic API key must start with "sk-ant-"' };
      }
      return { valid: true };
    }

    throw new BadRequestException(`Unknown provider: ${provider}`);
  }

  /**
   * Masks an encrypted API key for safe display. Shows only last 4 chars.
   * @param encryptedKey - The encrypted key from the database, or null
   * @returns Masked string like "...xxxx" or null if no key stored
   */
  private maskKey(encryptedKey: string | null): string | null {
    if (!encryptedKey) {
      return null;
    }

    try {
      const decrypted = this.encryption.decrypt(encryptedKey);
      const last4 = decrypted.slice(-4);
      return `...${last4}`;
    } catch {
      return '...****';
    }
  }
}
