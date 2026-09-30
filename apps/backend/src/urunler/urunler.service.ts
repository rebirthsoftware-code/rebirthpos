import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomInt } from 'node:crypto';
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

  /** Barkod okutulduğunda: şubedeki ürünü barkodla bulur. */
  async barkodlaBul(barkod: string, subeId: string, user: CurrentUserData) {
    subeYetkiKontrolu(user, subeId);
    const urun = await this.prisma.urun.findFirst({
      where: { subeId, barkod: barkod.trim() },
      include: { kategori: { select: { id: true, ad: true, renk: true } } },
    });
    if (!urun) throw new NotFoundException('Bu barkodla kayıtlı ürün yok');
    return urun;
  }

  /**
   * Barkodu olmayan ürünler için şubede kullanılmayan mağaza içi EAN-13 üretir.
   * "2" ile başlayan aralık GS1 tarafından iç kullanıma ayrılmıştır; üretici barkodlarıyla çakışmaz.
   */
  async yeniBarkod(subeId: string, user: CurrentUserData) {
    subeYetkiKontrolu(user, subeId);
    for (let deneme = 0; deneme < 20; deneme++) {
      const ilk12 = '20' + String(randomInt(0, 1e10)).padStart(10, '0');
      const barkod = ilk12 + ean13KontrolHanesi(ilk12);
      const varMi = await this.prisma.urun.findFirst({ where: { subeId, barkod }, select: { id: true } });
      if (!varMi) return { barkod };
    }
    throw new ConflictException('Barkod üretilemedi, tekrar deneyin');
  }

  /** Şubedeki barkodu olmayan tüm ürünlere mağaza içi barkod verir. */
  async barkodsuzlaraUret(subeId: string, user: CurrentUserData) {
    subeYetkiKontrolu(user, subeId);
    const barkodsuzlar = await this.prisma.urun.findMany({
      where: { subeId, OR: [{ barkod: null }, { barkod: '' }] },
      select: { id: true },
    });
    for (const u of barkodsuzlar) {
      const { barkod } = await this.yeniBarkod(subeId, user);
      await this.prisma.urun.update({ where: { id: u.id }, data: { barkod } });
    }
    return { guncellenen: barkodsuzlar.length };
  }

  private async barkodCakismaKontrolu(subeId: string, barkod: string | null | undefined, haricId?: string) {
    if (!barkod) return;
    const cakisan = await this.prisma.urun.findFirst({
      where: { subeId, barkod, ...(haricId ? { id: { not: haricId } } : {}) },
      select: { ad: true },
    });
    if (cakisan) throw new ConflictException(`Bu barkod zaten "${cakisan.ad}" ürününde kayıtlı`);
  }

  async olustur(dto: UrunCreateDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    dto.barkod = dto.barkod?.trim() || null;
    await this.barkodCakismaKontrolu(dto.subeId, dto.barkod);
    if (dto.kategoriId) {
      const k = await this.prisma.kategori.findUnique({ where: { id: dto.kategoriId } });
      if (!k || k.subeId !== dto.subeId) {
        throw new NotFoundException('Kategori bulunamadı veya farklı şubeye ait');
      }
    }
    return this.prisma.urun.create({ data: dto as any, include: { kategori: true } });
  }

  async guncelle(id: string, dto: UrunUpdateDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    if (dto.barkod !== undefined) {
      dto.barkod = dto.barkod?.trim() || null;
      await this.barkodCakismaKontrolu(mevcut.subeId, dto.barkod, id);
    }
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

function ean13KontrolHanesi(ilk12: string): string {
  let t = 0;
  for (let i = 0; i < 12; i++) t += Number(ilk12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (t % 10)) % 10);
}
