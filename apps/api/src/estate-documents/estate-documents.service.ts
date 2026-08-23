import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateEstateDocumentDto, UpdateEstateDocumentDto } from './dto/estate-document.dto';

@Injectable()
export class EstateDocumentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.estateDocument.findMany({
      where: { userId },
      orderBy: [{ isActive: 'desc' }, { reviewDate: 'asc' }],
    });
  }

  create(userId: string, dto: CreateEstateDocumentDto) {
    return this.prisma.estateDocument.create({
      data: { ...dto, userId, reviewDate: dto.reviewDate ? new Date(`${dto.reviewDate}T00:00:00.000Z`) : null },
    });
  }

  async update(userId: string, id: string, dto: UpdateEstateDocumentDto) {
    const existing = await this.prisma.estateDocument.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Estate-planning record not found');
    return this.prisma.estateDocument.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.reviewDate !== undefined && {
          reviewDate: dto.reviewDate ? new Date(`${dto.reviewDate}T00:00:00.000Z`) : null,
        }),
      },
    });
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.estateDocument.findFirst({ where: { id, userId }, select: { id: true } });
    if (!existing) throw new NotFoundException('Estate-planning record not found');
    await this.prisma.estateDocument.delete({ where: { id } });
  }
}
