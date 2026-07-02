import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { parse, ParseResult, ColumnMapping, ImportFormat, ParsedTransaction } from '@wardkeep/importers';
import { Decimal } from 'decimal.js';

import { PrismaService } from '../prisma/prisma.service';
import { RulesService } from '../rules/rules.service';
import { UploadImportDto } from './dto/upload-import.dto';

/** Stored upload data keyed by fileId. */
interface StoredUpload {
  userId: string;
  accountId: string;
  parseResult: ParseResult;
  createdAt: Date;
}

/** Summary returned after committing an import. */
export interface ImportSummary {
  totalRows: number;
  imported: number;
  duplicatesSkipped: number;
  errors: number;
}

/** Preview response returned after uploading. */
export interface UploadPreview {
  fileId: string;
  preview: ParsedTransaction[];
  totalRows: number;
  errors: { line: number; reason: string }[];
}

/** TTL for stored uploads: 30 minutes. */
const UPLOAD_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class ImportService {
  /** In-memory store for parsed upload data, keyed by fileId. */
  private readonly uploadStore = new Map<string, StoredUpload>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesService: RulesService,
  ) {}

  /**
   * Parses an uploaded file and stores the result for later commit.
   * Returns a preview of the first 10 parsed transactions.
   * @param userId - The authenticated user's ID
   * @param dto - The upload DTO with base64 content and format
   * @returns Preview with fileId, first 10 transactions, totalRows, and errors
   * @throws BadRequestException if the content cannot be decoded
   */
  async upload(userId: string, dto: UploadImportDto): Promise<UploadPreview> {
    this.cleanExpiredUploads();

    const buffer = this.decodeBase64(dto.content);
    const mapping: ColumnMapping | undefined = dto.mapping
      ? { date: dto.mapping.date, amount: dto.mapping.amount, description: dto.mapping.description, category: dto.mapping.category }
      : undefined;

    const parseResult = parse(buffer, dto.format as ImportFormat, mapping);
    const fileId = randomUUID();

    this.uploadStore.set(fileId, {
      userId,
      accountId: dto.accountId,
      parseResult,
      createdAt: new Date(),
    });

    return {
      fileId,
      preview: parseResult.transactions.slice(0, 10),
      totalRows: parseResult.totalRows,
      errors: parseResult.errors,
    };
  }

  /**
   * Commits previously uploaded and parsed transactions to the database.
   * Performs duplicate detection, inserts new transactions, and applies rules.
   * @param userId - The authenticated user's ID
   * @param fileId - The fileId from a previous upload
   * @param accountId - The target account ID for the transactions
   * @returns Import summary with counts of imported, duplicates, and errors
   * @throws NotFoundException if the fileId is not found or does not belong to the user
   * @throws BadRequestException if the accountId does not match the upload
   */
  async commit(userId: string, fileId: string, accountId: string): Promise<ImportSummary> {
    const stored = this.uploadStore.get(fileId);

    if (!stored || stored.userId !== userId) {
      throw new NotFoundException('Upload not found or expired');
    }

    if (stored.accountId !== accountId) {
      throw new BadRequestException('Account ID does not match the original upload');
    }

    const { parseResult } = stored;
    let imported = 0;
    let duplicatesSkipped = 0;

    for (const tx of parseResult.transactions) {
      const isDuplicate = await this.isDuplicate(userId, accountId, tx);

      if (isDuplicate) {
        duplicatesSkipped++;
        continue;
      }

      const created = await this.prisma.transaction.create({
        data: {
          userId,
          accountId,
          date: new Date(tx.date),
          amount: new Decimal(tx.amount),
          type: tx.type,
          description: tx.description,
          merchant: tx.description,
          categoryId: null,
          notes: null,
        },
      });

      await this.applyRulesToImportedTransaction(userId, created.id, tx);
      imported++;
    }

    // Clean up stored data after commit
    this.uploadStore.delete(fileId);

    return {
      totalRows: parseResult.totalRows,
      imported,
      duplicatesSkipped,
      errors: parseResult.errors.length,
    };
  }

  /**
   * Checks if a transaction is a duplicate based on date, amount, and description (case-insensitive).
   * @param userId - The user's ID
   * @param accountId - The account ID
   * @param tx - The parsed transaction to check
   * @returns true if a matching transaction already exists
   */
  private async isDuplicate(
    userId: string,
    accountId: string,
    tx: ParsedTransaction,
  ): Promise<boolean> {
    const existing = await this.prisma.transaction.findFirst({
      where: {
        accountId,
        userId,
        date: new Date(tx.date),
        amount: new Decimal(tx.amount),
        description: { equals: tx.description ?? '', mode: 'insensitive' },
      },
    });

    return existing !== null;
  }

  /**
   * Applies the rules engine to an imported transaction for auto-categorization.
   * @param userId - The user's ID
   * @param transactionId - The newly created transaction's ID
   * @param tx - The parsed transaction data
   */
  private async applyRulesToImportedTransaction(
    userId: string,
    transactionId: string,
    tx: ParsedTransaction,
  ): Promise<void> {
    await this.rulesService.applyRulesToTransaction(userId, {
      id: transactionId,
      merchant: tx.description,
      amount: tx.amount,
      description: tx.description,
    });
  }

  /**
   * Decodes a base64-encoded string to a Buffer.
   * @param content - The base64-encoded string
   * @returns The decoded Buffer
   * @throws BadRequestException if the content is not valid base64
   */
  private decodeBase64(content: string): Buffer {
    try {
      return Buffer.from(content, 'base64');
    } catch {
      throw new BadRequestException('Invalid base64 content');
    }
  }

  /**
   * Removes expired uploads from the in-memory store.
   * Called before each new upload to prevent memory leaks.
   */
  private cleanExpiredUploads(): void {
    const now = Date.now();
    for (const [key, value] of this.uploadStore.entries()) {
      if (now - value.createdAt.getTime() > UPLOAD_TTL_MS) {
        this.uploadStore.delete(key);
      }
    }
  }
}
