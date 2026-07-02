import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT_API } from '@wardkeep/shared';

import { AccountsModule } from './accounts/accounts.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { BankConnectionsModule } from './bank-connections/bank-connections.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { DebtModule } from './debt/debt.module';
import { ImportModule } from './import/import.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { RecurringModule } from './recurring/recurring.module';
import { RulesModule } from './rules/rules.module';
import { SettingsModule } from './settings/settings.module';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60000,
        limit: RATE_LIMIT_API,
      },
    ]),
    PrismaModule,
    CommonModule,
    NotificationsModule,
    HealthModule,
    AuthModule,
    AccountsModule,
    AiChatModule,
    BackupModule,
    BankConnectionsModule,
    BudgetsModule,
    CashflowModule,
    CategoriesModule,
    DebtModule,
    RecurringModule,
    RulesModule,
    SettingsModule,
    TransactionsModule,
    ImportModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
