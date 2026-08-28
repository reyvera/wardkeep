import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT_API } from '@wardkeep/shared';

import { AccountsModule } from './accounts/accounts.module';
import { AiChatModule } from './ai-chat/ai-chat.module';
import { AdvisorModule } from './advisor/advisor.module';
import { AuthModule } from './auth/auth.module';
import { BackupModule } from './backup/backup.module';
import { BankConnectionsModule } from './bank-connections/bank-connections.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CashflowModule } from './cashflow/cashflow.module';
import { CapabilitiesModule } from './capabilities/capabilities.module';
import { CategoriesModule } from './categories/categories.module';
import { CommonModule } from './common/common.module';
import { DebtModule } from './debt/debt.module';
import { DependentsModule } from './dependents/dependents.module';
import { EstateDocumentsModule } from './estate-documents/estate-documents.module';
import { EmergencyPreparednessModule } from './emergency-preparedness/emergency-preparedness.module';
import { FinancialGoalsModule } from './financial-goals/financial-goals.module';
import { ImportModule } from './import/import.module';
import { IncomeSourcesModule } from './income-sources/income-sources.module';
import { HouseholdObligationsModule } from './household-obligations/household-obligations.module';
import { HouseholdTransitionsModule } from './household-transitions/household-transitions.module';
import { PlannedExpensesModule } from './planned-expenses/planned-expenses.module';
import { InsuranceModule } from './insurance/insurance.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { HomeMaintenanceModule } from './home-maintenance/home-maintenance.module';
import { ReadinessModule } from './readiness/readiness.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { RecurringModule } from './recurring/recurring.module';
import { RulesModule } from './rules/rules.module';
import { SettingsModule } from './settings/settings.module';
import { TransactionsModule } from './transactions/transactions.module';
import { TimelineModule } from './timeline/timeline.module';
import { VehiclesModule } from './vehicles/vehicles.module';

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
    HomeMaintenanceModule,
    AuthModule,
    AccountsModule,
    AiChatModule,
    AdvisorModule,
    BackupModule,
    BankConnectionsModule,
    BudgetsModule,
    CashflowModule,
    CapabilitiesModule,
    CategoriesModule,
    DebtModule,
    DependentsModule,
    EstateDocumentsModule,
    EmergencyPreparednessModule,
    FinancialGoalsModule,
    RecurringModule,
    ReadinessModule,
    RecommendationsModule,
    RulesModule,
    SettingsModule,
    TransactionsModule,
    TimelineModule,
    VehiclesModule,
    ImportModule,
    IncomeSourcesModule,
    HouseholdObligationsModule,
    HouseholdTransitionsModule,
    PlannedExpensesModule,
    InsuranceModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
