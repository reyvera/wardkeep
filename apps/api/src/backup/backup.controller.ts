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
import { BackupService } from './backup.service';
import { CreateBackupSchema } from './dto/create-backup.dto';
import { RestoreBackupSchema, SetScheduleSchema } from './dto/restore-backup.dto';

@Controller('backup')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  /**
   * Creates an encrypted backup of all user data.
   * @param req - The scoped request with userId and body containing passphrase
   * @returns Backup metadata (id, filename, size, createdAt)
   */
  @Post('create')
  @HttpCode(HttpStatus.CREATED)
  async createBackup(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CreateBackupSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.backupService.createBackup(userId, result.data.passphrase);
  }

  /**
   * Restores user data from an encrypted backup.
   * Validates auth tag before modifying data; aborts on incorrect passphrase.
   * @param req - The scoped request with userId and body containing backupId and passphrase
   * @returns Success message
   */
  @Post('restore')
  @HttpCode(HttpStatus.OK)
  async restoreBackup(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = RestoreBackupSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.backupService.restoreBackup(
      userId,
      result.data.backupId,
      result.data.passphrase,
    );
  }

  /**
   * Lists all backups for the authenticated user (metadata only).
   * @param req - The scoped request with userId
   * @returns Array of backup metadata
   */
  @Get('list')
  async listBackups(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    return this.backupService.listBackups(userId);
  }

  /**
   * Sets or clears the automatic backup schedule.
   * @param req - The scoped request with userId and body containing schedule
   * @returns The updated schedule setting
   */
  @Patch('schedule')
  async setSchedule(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = SetScheduleSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.backupService.setSchedule(userId, result.data.schedule);
  }
}
