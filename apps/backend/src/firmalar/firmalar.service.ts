import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FirmaCreateDto, FirmaUpdateDto } from './dto/firma.dto';

@Injectable()
export class FirmalarService {
  constructor(private prisma: PrismaService) {}

  liste() {
    return this.prisma.firma.findMany({
      orderBy: { ad: 'asc' },
      include: { _count: { select: { subeler: true } } },
    });
  }

  async getir(id: string) {
    const firma = await this.prisma.firma.findUnique({
      where: { id },
      include: { subeler: true },
    });
    if (!firma) throw new NotFoundException('Firma bulunamadı');
    return firma;
  }

  olustur(dto: FirmaCreateDto) {
    return this.prisma.firma.create({ data: dto });
  }

  async guncelle(id: string, dto: FirmaUpdateDto) {
    await this.getir(id);
    return this.prisma.firma.update({ where: { id }, data: dto });
  }

  async sil(id: string) {
    await this.getir(id);
    await this.prisma.firma.delete({ where: { id } });
    return { silindi: true };
  }
}
