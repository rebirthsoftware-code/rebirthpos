import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KatCreateDto, KatUpdateDto } from './dto/kat.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';

@Injectable()
export class KatlarService {
  constructor(private prisma: PrismaService) {}

  async liste(user: CurrentUserData, subeId?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    return this.prisma.kat.findMany({
      where,
      orderBy: [{ sira: 'asc' }, { ad: 'asc' }],
      include: { _count: { select: { masalar: true } } },
    });
  }

  async getir(id: string, user: CurrentUserData) {
    const kat = await this.prisma.kat.findUnique({ where: { id } });
    if (!kat) throw new NotFoundException('Kat bulunamadı');
    subeYetkiKontrolu(user, kat.subeId);
    return kat;
  }

  async olustur(dto: KatCreateDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    return this.prisma.kat.create({ data: dto });
  }

  async guncelle(id: string, dto: KatUpdateDto, user: CurrentUserData) {
    await this.getir(id, user);
    return this.prisma.kat.update({ where: { id }, data: dto });
  }

  async sil(id: string, user: CurrentUserData) {
    await this.getir(id, user);
    await this.prisma.kat.delete({ where: { id } });
    return { silindi: true };
  }
}
