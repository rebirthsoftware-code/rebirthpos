import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdisyonAcDto, AdisyonGuncelleDto } from './dto/adisyon.dto';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { erisilebilirSubeler, subeYetkiKontrolu } from '../common/tenant';
import { AdisyonDurum, MasaDurum } from '../common/enums';
import { adisyonNumarasiUret, hesaplaAdisyonTutar } from './adisyon-hesap';
import { Prisma } from '@prisma/client';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

const FULL_INCLUDE = {
  masa: { select: { id: true, ad: true } },
  acanKullanici: { select: { id: true, adSoyad: true } },
  siparisler: {
    include: {
      kalemler: {
        include: { urun: { select: { id: true, ad: true, kdvOrani: true } } },
      },
    },
    orderBy: { olusturuldu: 'asc' as const },
  },
  odemeler: { orderBy: { olusturuldu: 'asc' as const } },
} as const;

@Injectable()
export class AdisyonlarService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private denetim: DenetimService,
  ) {}

  async liste(user: CurrentUserData, subeId?: string, durum?: string) {
    const erisim = erisilebilirSubeler(user);
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    } else if (!erisim.hepsi) {
      where.subeId = { in: erisim.ids };
    }
    if (durum) where.durum = durum;
    else where.durum = { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR] };
    return this.prisma.adisyon.findMany({
      where,
      include: {
        masa: { select: { id: true, ad: true } },
        acanKullanici: { select: { id: true, adSoyad: true } },
        _count: { select: { siparisler: true } },
      },
      orderBy: { acilis: 'desc' },
    });
  }

  async getir(id: string, user: CurrentUserData) {
    const ad = await this.prisma.adisyon.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!ad) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, ad.subeId);
    return ad;
  }

  async masaIcinAktif(masaId: string, user: CurrentUserData) {
    const masa = await this.prisma.masa.findUnique({ where: { id: masaId } });
    if (!masa) throw new NotFoundException('Masa bulunamadı');
    subeYetkiKontrolu(user, masa.subeId);
    return this.prisma.adisyon.findFirst({
      where: {
        masaId,
        durum: { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR] },
      },
      include: FULL_INCLUDE,
    });
  }

  async ac(dto: AdisyonAcDto, user: CurrentUserData) {
    subeYetkiKontrolu(user, dto.subeId);
    if (dto.masaId) {
      const masa = await this.prisma.masa.findUnique({ where: { id: dto.masaId } });
      if (!masa || masa.subeId !== dto.subeId) {
        throw new BadRequestException('Masa bulunamadı veya farklı şubede');
      }
      const aktif = await this.prisma.adisyon.findFirst({
        where: {
          masaId: dto.masaId,
          durum: { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR] },
        },
      });
      if (aktif) {
        throw new BadRequestException('Bu masada zaten açık adisyon var');
      }
    }

    // Bugünün adisyon sayısını al (numara için)
    const bugunBaslangic = new Date();
    bugunBaslangic.setHours(0, 0, 0, 0);
    const bugunkuSayi = await this.prisma.adisyon.count({
      where: { subeId: dto.subeId, acilis: { gte: bugunBaslangic } },
    });
    const numara = adisyonNumarasiUret(bugunkuSayi);

    const adisyon = await this.prisma.adisyon.create({
      data: {
        subeId: dto.subeId,
        masaId: dto.masaId,
        acanKullaniciId: user.kullaniciId,
        numara,
        not: dto.not,
        durum: AdisyonDurum.ACIK,
      },
      include: FULL_INCLUDE,
    });

    if (dto.masaId) {
      await this.prisma.masa.update({
        where: { id: dto.masaId },
        data: { durum: MasaDurum.DOLU },
      });
      this.realtime.masaDurumDegisti(dto.subeId, {
        masaId: dto.masaId,
        durum: MasaDurum.DOLU,
      });
    }

    this.realtime.adisyonGuncellendi(dto.subeId, {
      adisyonId: adisyon.id,
      durum: adisyon.durum,
      masaId: adisyon.masaId,
      yeni: true,
    });

    return adisyon;
  }

  async guncelle(id: string, dto: AdisyonGuncelleDto, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    if (mevcut.durum === AdisyonDurum.KAPALI || mevcut.durum === AdisyonDurum.IPTAL) {
      throw new BadRequestException('Kapanmış adisyon güncellenemez');
    }
    const data: any = {};
    if (dto.not !== undefined) data.not = dto.not;
    const iskontoDegisti =
      dto.iskontoTutar !== undefined &&
      Number(dto.iskontoTutar) !== Number(mevcut.iskontoTutar);
    if (dto.iskontoTutar !== undefined) {
      data.iskontoTutar = new Prisma.Decimal(dto.iskontoTutar);
      // Toplamı yeniden hesapla
      const kalemler = mevcut.siparisler.flatMap((s) =>
        s.kalemler
          .filter((k) => !k.iptal)
          .map((k) => ({
            adet: k.adet,
            birimFiyat: k.birimFiyat,
            urunKdvOrani: k.urun.kdvOrani,
          })),
      );
      const t = hesaplaAdisyonTutar(kalemler, dto.iskontoTutar);
      data.araToplam = t.araToplam;
      data.kdvTutar = t.kdvTutar;
      data.toplamTutar = t.toplamTutar;
      data.kdvDokumu = JSON.stringify(t.kdvDokumu);
    }

    return this.prisma.$transaction(async (tx) => {
      const guncel = await tx.adisyon.update({ where: { id }, data, include: FULL_INCLUDE });
      if (iskontoDegisti) {
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.ADISYON_ISKONTO,
          entityTipi: 'Adisyon',
          entityId: id,
          subeId: mevcut.subeId,
          ozet: `İskonto ${Number(mevcut.iskontoTutar).toFixed(2)}₺ → ${Number(dto.iskontoTutar).toFixed(2)}₺ (adisyon ${mevcut.numara})`,
          onceki: { iskontoTutar: Number(mevcut.iskontoTutar), toplamTutar: Number(mevcut.toplamTutar) },
          sonraki: { iskontoTutar: Number(dto.iskontoTutar), toplamTutar: Number(guncel.toplamTutar) },
        });
      }
      return guncel;
    });
  }

  async iptal(id: string, user: CurrentUserData) {
    const mevcut = await this.getir(id, user);
    if (mevcut.durum === AdisyonDurum.KAPALI) {
      throw new BadRequestException('Kapanmış adisyon iptal edilemez');
    }

    const adisyon = await this.prisma.$transaction(async (tx) => {
      const a = await tx.adisyon.update({
        where: { id },
        data: { durum: AdisyonDurum.IPTAL, kapanis: new Date() },
        include: FULL_INCLUDE,
      });
      if (mevcut.masaId) {
        await tx.masa.update({
          where: { id: mevcut.masaId },
          data: { durum: MasaDurum.BOS },
        });
      }
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.ADISYON_IPTAL,
        entityTipi: 'Adisyon',
        entityId: id,
        subeId: mevcut.subeId,
        ozet: `Adisyon ${mevcut.numara} iptal edildi (toplam ${Number(mevcut.toplamTutar).toFixed(2)}₺)`,
        onceki: {
          durum: mevcut.durum,
          toplamTutar: Number(mevcut.toplamTutar),
          kalemSayisi: mevcut.siparisler.reduce(
            (s, sip) => s + sip.kalemler.filter((k) => !k.iptal).length,
            0,
          ),
        },
        sonraki: { durum: AdisyonDurum.IPTAL },
      });
      return a;
    });

    if (mevcut.masaId) {
      this.realtime.masaDurumDegisti(mevcut.subeId, {
        masaId: mevcut.masaId,
        durum: MasaDurum.BOS,
      });
    }
    this.realtime.adisyonGuncellendi(mevcut.subeId, {
      adisyonId: id,
      durum: AdisyonDurum.IPTAL,
    });
    return adisyon;
  }

  /**
   * Adisyon tutarını sipariş kalemlerinden yeniden hesaplar ve kaydeder.
   * Sipariş ekleme/silme sonrası çağrılır.
   */
  async tutariYenidenHesapla(adisyonId: string) {
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: adisyonId },
      include: {
        siparisler: {
          include: { kalemler: { include: { urun: true } } },
        },
      },
    });
    if (!adisyon) return;
    const kalemler = adisyon.siparisler.flatMap((s) =>
      s.kalemler
        .filter((k) => !k.iptal)
        .map((k) => ({
          adet: k.adet,
          birimFiyat: k.birimFiyat,
          urunKdvOrani: k.urun.kdvOrani,
        })),
    );
    const t = hesaplaAdisyonTutar(kalemler, adisyon.iskontoTutar);
    await this.prisma.adisyon.update({
      where: { id: adisyonId },
      data: {
        araToplam: t.araToplam,
        kdvTutar: t.kdvTutar,
        toplamTutar: t.toplamTutar,
        kdvDokumu: JSON.stringify(t.kdvDokumu),
      },
    });
  }
}
