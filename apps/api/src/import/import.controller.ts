import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
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
import { ImportService } from './import.service';
import { CommitImportSchema } from './dto/commit-import.dto';
import { UploadImportSchema } from './dto/upload-import.dto';

@Controller('import')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  /**
   * Uploads and parses a file, returning a preview of the first 10 transactions.
   * Expects base64-encoded file content in the request body.
   * @param req - The scoped request with userId and body
   * @returns Upload preview with fileId, first 10 transactions, totalRows, and errors
   */
  @Post('upload')
  async upload(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = UploadImportSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.importService.upload(userId, result.data);
  }

  /**
   * Commits previously uploaded transactions to the database.
   * Performs duplicate detection and applies the rules engine.
   * @param req - The scoped request with userId and body
   * @returns Import summary with imported, duplicates skipped, and error counts
   */
  @Post('commit')
  @HttpCode(HttpStatus.OK)
  async commit(@Req() req: ScopedRequest) {
    const userId = req.userId!;
    const result = CommitImportSchema.safeParse(req.body);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return this.importService.commit(userId, result.data.fileId, result.data.accountId);
  }
}
