import { BadRequestException, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';

import { AuthGuard } from '../common/guards/auth.guard';
import { ScopedRequest, UserScopeInterceptor } from '../common/interceptors/user-scope.interceptor';
import { CreateEstateDocumentSchema, UpdateEstateDocumentSchema } from './dto/estate-document.dto';
import { EstateDocumentsService } from './estate-documents.service';

@Controller('estate-documents')
@UseGuards(AuthGuard)
@UseInterceptors(UserScopeInterceptor)
export class EstateDocumentsController {
  constructor(private readonly estateDocuments: EstateDocumentsService) {}

  @Get() list(@Req() req: ScopedRequest) { return this.estateDocuments.list(req.userId!); }
  @Post() create(@Req() req: ScopedRequest) {
    const parsed = CreateEstateDocumentSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.estateDocuments.create(req.userId!, parsed.data);
  }
  @Patch(':id') update(@Req() req: ScopedRequest, @Param('id') id: string) {
    const parsed = UpdateEstateDocumentSchema.safeParse(req.body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten().fieldErrors);
    return this.estateDocuments.update(req.userId!, id, parsed.data);
  }
  @Delete(':id') @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: ScopedRequest, @Param('id') id: string) { return this.estateDocuments.remove(req.userId!, id); }
}
