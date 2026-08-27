import { Module } from '@nestjs/common';

import { FinancialGoalsController } from './financial-goals.controller';
import { FinancialGoalsService } from './financial-goals.service';

@Module({ controllers: [FinancialGoalsController], providers: [FinancialGoalsService] })
export class FinancialGoalsModule {}
