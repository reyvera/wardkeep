import { Module } from '@nestjs/common';

import { EstateDocumentsController } from './estate-documents.controller';
import { EstateDocumentsService } from './estate-documents.service';

@Module({ controllers: [EstateDocumentsController], providers: [EstateDocumentsService] })
export class EstateDocumentsModule {}
