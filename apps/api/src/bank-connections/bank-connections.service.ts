import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { CreateBankConnectionDto } from './dto/create-connection.dto';

/**
 * Service for managing bank connections (SimpleFIN/Plaid).
 * Handles connection creation, token exchange, syncing, and unlinking.
 */
@Injectable()
export class BankConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Lists all bank connections for a user.
   * @param userId - The user ID
   * @returns Array of bank connections with linked accounts
   */
  async listConnections(userId: string) {
    return this.prisma.bankConnection.findMany({
      where: { userId },
      include: {
        linkedAccounts: {
          include: { account: { select: { id: true, name: true, type: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates a new bank connection by exchanging a setup token for an access token.
   * @param userId - The user ID
   * @param dto - Connection creation data including provider and setup token
   * @returns The created connection with discovered accounts
   */
  async createConnection(userId: string, dto: CreateBankConnectionDto) {
    // Exchange setup token for access token based on provider
    let accessToken: string;
    let discoveredAccounts: Array<{ externalId: string; name: string; type: string }>;

    if (dto.provider === 'SIMPLEFIN') {
      const result = await this.exchangeSimplefinToken(dto.setupToken);
      accessToken = result.accessUrl;
      discoveredAccounts = result.accounts;
    } else {
      // Plaid flow — for now just store the token directly
      accessToken = dto.setupToken;
      discoveredAccounts = [];
    }

    // Encrypt the access token before storage
    const encryptedToken = this.encryption.encrypt(accessToken);

    // Create connection and linked accounts in a transaction
    const connection = await this.prisma.bankConnection.create({
      data: {
        userId,
        provider: dto.provider,
        institutionName: dto.institutionName,
        accessToken: encryptedToken,
        status: 'ACTIVE',
        linkedAccounts: {
          create: discoveredAccounts.map((acct) => ({
            externalId: acct.externalId,
            externalName: acct.name,
            externalType: acct.type,
            isEnabled: true,
          })),
        },
      },
      include: { linkedAccounts: true },
    });

    return connection;
  }

  /**
   * Removes a bank connection and all linked account associations.
   * Does NOT delete the local accounts or their transactions.
   * @param userId - The user ID
   * @param connectionId - The connection ID to remove
   */
  async removeConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.bankConnection.findFirst({
      where: { id: connectionId, userId },
    });

    if (!connection) {
      throw new NotFoundException('Bank connection not found');
    }

    await this.prisma.bankConnection.delete({ where: { id: connectionId } });
    return { success: true };
  }

  /**
   * Links a discovered external bank account to a local account.
   * @param userId - The user ID
   * @param linkedBankAccountId - The LinkedBankAccount record ID
   * @param accountId - The local Account ID to link to
   */
  async linkAccount(userId: string, linkedBankAccountId: string, accountId: string) {
    const linkedAccount = await this.prisma.linkedBankAccount.findFirst({
      where: { id: linkedBankAccountId, connection: { userId } },
    });

    if (!linkedAccount) {
      throw new NotFoundException('Linked bank account not found');
    }

    // Verify the local account belongs to this user
    const localAccount = await this.prisma.account.findFirst({
      where: { id: accountId, userId },
    });

    if (!localAccount) {
      throw new BadRequestException('Local account not found');
    }

    return this.prisma.linkedBankAccount.update({
      where: { id: linkedBankAccountId },
      data: { accountId },
    });
  }

  /**
   * Triggers a manual sync for a specific connection.
   * Fetches latest transactions from the provider and imports them.
   * @param userId - The user ID
   * @param connectionId - The connection to sync
   * @returns Sync results with counts
   */
  async syncConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.bankConnection.findFirst({
      where: { id: connectionId, userId, status: 'ACTIVE' },
      include: { linkedAccounts: { where: { isEnabled: true, accountId: { not: null } } } },
    });

    if (!connection) {
      throw new NotFoundException('Active bank connection not found');
    }

    // Decrypt access token
    const accessToken = this.encryption.decrypt(connection.accessToken);

    let imported = 0;
    let skippedDuplicates = 0;

    if (connection.provider === 'SIMPLEFIN') {
      const result = await this.fetchSimplefinTransactions(accessToken, connection.linkedAccounts);
      imported = result.imported;
      skippedDuplicates = result.skippedDuplicates;
    }

    // Update last sync timestamp
    await this.prisma.bankConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date(), lastError: null },
    });

    return { imported, skippedDuplicates, syncedAt: new Date().toISOString() };
  }

  /**
   * Exchanges a SimpleFIN setup token for an access URL.
   * Accepts either:
   * - A Base64-encoded claim token (standard flow)
   * - A direct access URL (e.g. https://user:pass@beta-bridge.simplefin.org/simplefin)
   */
  private async exchangeSimplefinToken(setupToken: string) {
    try {
      let accessUrl: string;

      // If it looks like a URL already, treat it as a direct access URL
      if (setupToken.startsWith('https://')) {
        accessUrl = setupToken;
      } else {
        // Decode the Base64 setup token to get the claim URL
        const claimUrl = Buffer.from(setupToken, 'base64').toString('utf-8');

        if (!claimUrl.startsWith('https://')) {
          throw new BadRequestException('Invalid SimpleFIN token — decoded value is not a URL');
        }

        // POST to the claim URL to get the access URL
        const response = await fetch(claimUrl, { method: 'POST', redirect: 'follow' });

        if (response.status === 403) {
          throw new BadRequestException(
            'SimpleFIN token already claimed or invalid. Generate a new token.',
          );
        }

        if (!response.ok) {
          throw new BadRequestException(
            `Failed to exchange SimpleFIN setup token (HTTP ${response.status})`,
          );
        }

        accessUrl = (await response.text()).trim();
      }

      // Fetch accounts from the access URL
      const accountsResponse = await fetch(`${accessUrl}/accounts`);
      if (!accountsResponse.ok) {
        throw new BadRequestException(
          `Failed to fetch accounts from SimpleFIN (HTTP ${accountsResponse.status})`,
        );
      }

      const data = await accountsResponse.json();
      const accounts = (data.accounts ?? []).map((acct: Record<string, unknown>) => ({
        externalId: String(acct['id'] ?? ''),
        name: String(acct['name'] ?? 'Unknown'),
        type: String(acct['currency'] ?? 'USD'),
      }));

      return { accessUrl, accounts };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `Failed to connect to SimpleFIN: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Fetches transactions from SimpleFIN and imports them into linked local accounts.
   */
  private async fetchSimplefinTransactions(
    accessUrl: string,
    linkedAccounts: Array<{ externalId: string; accountId: string | null }>,
  ) {
    let imported = 0;
    let skippedDuplicates = 0;

    try {
      // Fetch transactions from last 30 days
      const since = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
      const response = await fetch(`${accessUrl}/accounts?start-date=${since}`);

      if (!response.ok) return { imported, skippedDuplicates };

      const data = await response.json();

      for (const extAccount of data.accounts ?? []) {
        const linked = linkedAccounts.find((la) => la.externalId === extAccount.id);
        if (!linked || !linked.accountId) continue;

        for (const tx of extAccount.transactions ?? []) {
          // SimpleFIN uses UNIX epoch timestamps for 'posted'
          const txDate = new Date(tx.posted * 1000);
          const amount = Math.abs(Number(tx.amount));
          const merchant = String(tx.description ?? 'Unknown').substring(0, 100);

          // Check for duplicate (same date + amount + description in same account)
          const existing = await this.prisma.transaction.findFirst({
            where: {
              accountId: linked.accountId,
              date: txDate,
              merchant: { equals: merchant, mode: 'insensitive' },
              amount: { equals: amount },
            },
          });

          if (existing) {
            skippedDuplicates++;
            continue;
          }

          // Determine the userId from the account
          const account = await this.prisma.account.findUnique({
            where: { id: linked.accountId },
            select: { userId: true },
          });

          if (!account) continue;

          await this.prisma.transaction.create({
            data: {
              userId: account.userId,
              accountId: linked.accountId,
              date: txDate,
              amount,
              type: Number(tx.amount) >= 0 ? 'INCOME' : 'EXPENSE',
              merchant,
              description: String(tx.memo ?? '').substring(0, 500) || null,
            },
          });

          imported++;
        }
      }
    } catch {
      // Non-fatal — sync error will be logged
    }

    return { imported, skippedDuplicates };
  }
}
