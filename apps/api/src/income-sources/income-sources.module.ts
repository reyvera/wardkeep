import { Module } from '@nestjs/common';
import { IncomeSourcesController } from './income-sources.controller';
import { IncomeSourcesService } from './income-sources.service';
@Module({ controllers: [IncomeSourcesController], providers: [IncomeSourcesService] })
export class IncomeSourcesModule {}
