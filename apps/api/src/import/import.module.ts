import { Module } from '@nestjs/common';

import { RulesModule } from '../rules/rules.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [RulesModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}
