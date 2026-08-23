import { Module } from '@nestjs/common';
import { DependentsController } from './dependents.controller';
import { DependentsService } from './dependents.service';
@Module({ controllers: [DependentsController], providers: [DependentsService] }) export class DependentsModule {}
