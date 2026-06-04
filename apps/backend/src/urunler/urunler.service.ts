import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UrunCreateDto, UrunUpdateDto } from './dto/urun.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

@Injectable()
export class UrunlerService {
  constructor(private prisma: PrismaService, private denetim: DenetimService) {}

  async liste(user: CurrentUserData, subeId?: string, kategoriId?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    if (kategoriId) where.kategoriId = kategoriId;
    return this.prisma.urun.findMany({
      where,
      orderBy: [{ ad: 'asc' }],
      include: { kategori: { select: { id: true, ad: true, renk: true } } },
    });
  }

  async getir(id: string, user: CurrentUserData) {
    const urun = await this.prisma.urun.findUnique({
      where: { id },
      include: { kategori: true },
    });
    if (!urun) throw new NotFoundException('Ürün bulunamadı');
    subeYetkiKontrolu(user, urun.subeId);
    return urun;
  }

  async olustur(dto: UrunCreateDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    if (dto.kategoriId) {
      const k = await this.prisma.kategori.findUnique({ where: { id: dto.kategoriId } });
      if (!k || k.subeId !== dto.subeId) {
        throw new NotFoundException('Kategori bulunamadı veya farklı şubeye ait');
      }
    }
    return this.prisma.urun.create({ data: dto, include: { kategori: true } });
  }

  async guncelle(id: string, dto: UrunUpdateDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    if (dto.kategoriId) {
      const k = await this.prisma.kategori.findUnique({ where: { id: dto.kategoriId } });
      if (!k || k.subeId !== mevcut.subeId) {
        throw new NotFoundException('Kategori bulunamadı veya farklı şubeye ait');
      }
    }

    const fiyatDegisti = dto.fiyat !== undefined && Number(dto.fiyat) !== Number(mevcut.fiyat);
    const kdvDegisti =
      dto.kdvOrani !== undefined && Number(dto.kdvOrani) !== Number(mevcut.kdvOrani);

    return this.prisma.$transaction(async (tx) => {
      const guncel = await tx.urun.update({
        where: { id },
        data: dto as any,
        include: { kategori: true },
      });
      if (fiyatDegisti) {
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.URUN_FIYAT_DEGISTI,
          entityTipi: 'Urun',
          entityId: id,
          subeId: mevcut.subeId,
          ozet: `${mevcut.ad}: ${Number(mevcut.fiyat).toFixed(2)}₺ → ${Number(dto.fiyat).toFixed(2)}₺`,
          onceki: { fiyat: Number(mevcut.fiyat) },
          sonraki: { fiyat: Number(dto.fiyat) },
        });
      }
      if (kdvDegisti) {
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.URUN_KDV_DEGISTI,
          entityTipi: 'Urun',
          entityId: id,
          subeId: mevcut.subeId,
          ozet: `${mevcut.ad} KDV: %${Number(mevcut.kdvOrani)} → %${Number(dto.kdvOrani)}`,
          onceki: { kdvOrani: Number(mevcut.kdvOrani) },
          sonraki: { kdvOrani: Number(dto.kdvOrani) },
        });
      }
      return guncel;
    });
  }

  async sil(id: string, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    return this.prisma.$transaction(async (tx) => {
      await tx.urun.delete({ where: { id } });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.URUN_SIL,
        entityTipi: 'Urun',
        entityId: id,
        subeId: mevcut.subeId,
        ozet: `Ürün silindi: ${mevcut.ad} (${Number(mevcut.fiyat).toFixed(2)}₺)`,
        onceki: {
          ad: mevcut.ad,
          fiyat: Number(mevcut.fiyat),
          kdvOrani: Number(mevcut.kdvOrani),
        },
      });
      return { silindi: true };
    });
  }
}
