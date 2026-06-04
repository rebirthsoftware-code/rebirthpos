import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MasaCreateDto, MasaUpdateDto } from './dto/masa.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';

@Injectable()
export class MasalarService {
  constructor(private prisma: PrismaService) {}

  async liste(user: CurrentUserData, subeId?: string, katId?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    if (katId === 'null') where.katId = null;
    else if (katId) where.katId = katId;
    return this.prisma.masa.findMany({
      where,
      orderBy: [{ ad: 'asc' }],
      include: { kat: { select: { id: true, ad: true } } },
    });
  }

  async getir(id: string, user: CurrentUserData) {
    const masa = await this.prisma.masa.findUnique({
      where: { id },
      include: { kat: true },
    });
    if (!masa) throw new NotFoundException('Masa bulunamadı');
    subeYetkiKontrolu(user, masa.subeId);
    return masa;
  }

  async olustur(dto: MasaCreateDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    if (dto.katId) {
      const k = await this.prisma.kat.findUnique({ where: { id: dto.katId } });
      if (!k || k.subeId !== dto.subeId) {
        throw new NotFoundException('Kat bulunamadı veya farklı şubeye ait');
      }
    }
    return this.prisma.masa.create({ data: dto, include: { kat: true } });
  }

  async guncelle(id: string, dto: MasaUpdateDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    if (dto.katId) {
      const k = await this.prisma.kat.findUnique({ where: { id: dto.katId } });
      if (!k || k.subeId !== mevcut.subeId) {
        throw new NotFoundException('Kat bulunamadı veya farklı şubeye ait');
      }
    }
    return this.prisma.masa.update({
      where: { id },
      data: dto as any,
      include: { kat: true },
    });
  }

  async sil(id: string, user: CurrentUserData) {
    await this.getir(id, user);
    await this.prisma.masa.delete({ where: { id } });
    return { silindi: true };
  }
}
