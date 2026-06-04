import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StokHareketDto } from './dto/stok.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

@Injectable()
export class StokService {
  constructor(private prisma: PrismaService, private denetim: DenetimService) {}

  async stokDurumu(user: CurrentUserData, subeId?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = { stokTakibi: true };
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    return this.prisma.urun.findMany({
      where,
      orderBy: { ad: 'asc' },
      select: {
        id: true,
        subeId: true,
        ad: true,
        stok: true,
        stokBirim: true,
        stokUyariEsigi: true,
        kategori: { select: { id: true, ad: true } },
      },
    });
  }

  async hareketler(user: CurrentUserData, urunId?: string, subeId?: string, limit = 100) {
    const where: any = {};
    if (urunId) where.urunId = urunId;
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.urun = { subeId };
    } else {
      const erisim = erisilebilirSubeler(user);
      if (!erisim.hepsi) where.urun = { subeId: { in: erisim.ids } };
    }
    return this.prisma.stokHareketi.findMany({
      where,
      orderBy: { olusturuldu: 'desc' },
      take: limit,
      include: {
        urun: { select: { id: true, ad: true, stokBirim: true } },
        kullanici: { select: { id: true, adSoyad: true } },
      },
    });
  }

  /**
   * Manuel stok hareketi — admin tarafından.
   * Tip yönü: GIRIS/IADE pozitif, CIKIS/FIRE negatif, DUZELTME mutlak.
   */
  async hareketEkle(dto: StokHareketDto, user: CurrentUserData) {
    const urun = await this.prisma.urun.findUnique({ where: { id: dto.urunId } });
    if (!urun) throw new NotFoundException('Ürün bulunamadı');
    subeYetkiKontrolu(user, urun.subeId);
    if (!urun.stokTakibi) throw new BadRequestException('Bu ürün için stok takibi açık değil');

    const oncesi = new Prisma.Decimal(urun.stok);
    let sonrasi: Prisma.Decimal;

    if (dto.tip === 'DUZELTME') {
      sonrasi = new Prisma.Decimal(dto.miktar);
    } else if (dto.tip === 'GIRIS' || dto.tip === 'IADE') {
      sonrasi = oncesi.add(dto.miktar);
    } else {
      sonrasi = oncesi.sub(dto.miktar);
      if (sonrasi.lt(0)) sonrasi = new Prisma.Decimal(0);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.urun.update({ where: { id: urun.id }, data: { stok: sonrasi } });
      const hareket = await tx.stokHareketi.create({
        data: {
          subeId: urun.subeId,
          urunId: urun.id,
          tip: dto.tip,
          miktar: new Prisma.Decimal(dto.miktar),
          oncesi,
          sonrasi,
          aciklama: dto.aciklama,
          kullaniciId: user.kullaniciId,
        },
      });
      // Manuel düzeltmeler ÖKC dışı stok manipülasyonu olarak loglanır.
      // SATIS/IADE gibi otomatik akışlar StokHareketi'nde zaten görünür.
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.STOK_DUZELTME,
        entityTipi: 'Urun',
        entityId: urun.id,
        subeId: urun.subeId,
        ozet: `Stok ${dto.tip}: ${urun.ad} (${Number(oncesi)} → ${Number(sonrasi)} ${urun.stokBirim})`,
        onceki: { stok: Number(oncesi) },
        sonraki: { stok: Number(sonrasi), tip: dto.tip, miktar: Number(dto.miktar), aciklama: dto.aciklama },
      });
      return hareket;
    });
  }

  /**
   * Sipariş alındığında otomatik stok düşümü.
   * Sipariş servisinden çağrılır. (kullaniciId opsiyonel — sistem kaynaklı QR siparişleri için)
   */
  async siparisSatisDus(kalemler: Array<{ urunId: string; adet: number }>, kullaniciId?: string) {
    for (const k of kalemler) {
      const urun = await this.prisma.urun.findUnique({ where: { id: k.urunId } });
      if (!urun || !urun.stokTakibi) continue;
      const oncesi = new Prisma.Decimal(urun.stok);
      const sonrasi = oncesi.sub(k.adet);
      await this.prisma.$transaction([
        this.prisma.urun.update({ where: { id: urun.id }, data: { stok: sonrasi } }),
        this.prisma.stokHareketi.create({
          data: {
            subeId: urun.subeId,
            urunId: urun.id,
            tip: 'SATIS',
            miktar: new Prisma.Decimal(k.adet),
            oncesi,
            sonrasi,
            aciklama: 'Otomatik satış düşümü',
            kullaniciId,
          },
        }),
      ]);
    }
  }
}
