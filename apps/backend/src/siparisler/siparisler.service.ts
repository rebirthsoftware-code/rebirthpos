import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SiparisOlusturDto } from './dto/siparis.dto';
import { AdisyonlarService } from '../adisyonlar/adisyonlar.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { subeYetkiKontrolu } from '../common/tenant';
import { AdisyonDurum, SiparisDurum } from '../common/enums';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { StokService } from '../stok/stok.service';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';

@Injectable()
export class SiparislerService {
  constructor(
    private prisma: PrismaService,
    private adisyonlar: AdisyonlarService,
    private realtime: RealtimeGateway,
    private stok: StokService,
    private denetim: DenetimService,
  ) {}

  async olustur(dto: SiparisOlusturDto, user: CurrentUserData) {
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: dto.adisyonId },
    });
    if (!adisyon) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, adisyon.subeId);
    if (adisyon.durum !== AdisyonDurum.ACIK && adisyon.durum !== AdisyonDurum.ODEME_BEKLIYOR) {
      throw new BadRequestException('Bu adisyona sipariş eklenemez');
    }
    if (!dto.kalemler.length) {
      throw new BadRequestException('En az bir kalem gerekli');
    }

    // Ürünleri toplu çek + şube doğrulaması
    const urunIds = dto.kalemler.map((k) => k.urunId);
    const urunler = await this.prisma.urun.findMany({ where: { id: { in: urunIds } } });
    const urunMap = new Map(urunler.map((u) => [u.id, u]));
    for (const k of dto.kalemler) {
      const u = urunMap.get(k.urunId);
      if (!u || u.subeId !== adisyon.subeId) {
        throw new BadRequestException('Geçersiz ürün: ' + k.urunId);
      }
      if (!u.aktif) {
        throw new BadRequestException(`Ürün pasif: ${u.ad}`);
      }
    }

    const siparis = await this.prisma.siparis.create({
      data: {
        subeId: adisyon.subeId,
        adisyonId: adisyon.id,
        kullaniciId: user.kullaniciId,
        kaynak: dto.kaynak || 'PANEL',
        not: dto.not,
        durum: SiparisDurum.ALINDI,
        kalemler: {
          create: dto.kalemler.map((k) => {
            const u = urunMap.get(k.urunId)!;
            const birim = new Prisma.Decimal(u.fiyat);
            const toplam = birim.mul(k.adet);
            return {
              urunId: k.urunId,
              adet: k.adet,
              birimFiyat: birim,
              toplam,
              not: k.not,
            };
          }),
        },
      },
      include: { kalemler: { include: { urun: true } } },
    });

    await this.adisyonlar.tutariYenidenHesapla(adisyon.id);
    // Stok takibi açık olan ürünler için otomatik düşüm
    await this.stok.siparisSatisDus(
      dto.kalemler.map((k) => ({ urunId: k.urunId, adet: k.adet })),
      user.kullaniciId,
    );
    this.realtime.yeniSiparis(adisyon.subeId, {
      siparisId: siparis.id,
      adisyonId: adisyon.id,
      masaId: adisyon.masaId,
      kaynak: siparis.kaynak,
      kalemSayisi: siparis.kalemler.length,
    });
    return siparis;
  }

  async kalemIptal(kalemId: string, user: CurrentUserData) {
    const kalem = await this.prisma.siparisKalem.findUnique({
      where: { id: kalemId },
      include: { siparis: true, urun: { select: { ad: true } } },
    });
    if (!kalem) throw new NotFoundException('Sipariş kalemi bulunamadı');
    subeYetkiKontrolu(user, kalem.siparis.subeId);
    if (kalem.iptal) {
      throw new BadRequestException('Bu kalem zaten iptal');
    }

    const guncel = await this.prisma.$transaction(async (tx) => {
      const k = await tx.siparisKalem.update({
        where: { id: kalemId },
        data: { iptal: true },
      });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.SIPARIS_KALEM_IPTAL,
        entityTipi: 'SiparisKalem',
        entityId: kalemId,
        subeId: kalem.siparis.subeId,
        ozet: `Kalem iptal: ${kalem.urun.ad} × ${kalem.adet} (${Number(kalem.toplam).toFixed(2)}₺)`,
        onceki: {
          urunAd: kalem.urun.ad,
          adet: kalem.adet,
          birimFiyat: Number(kalem.birimFiyat),
          toplam: Number(kalem.toplam),
          adisyonId: kalem.siparis.adisyonId,
        },
      });
      return k;
    });

    await this.adisyonlar.tutariYenidenHesapla(kalem.siparis.adisyonId);
    return guncel;
  }

  async durumGuncelle(siparisId: string, durum: string, user: CurrentUserData) {
    const s = await this.prisma.siparis.findUnique({ where: { id: siparisId } });
    if (!s) throw new NotFoundException('Sipariş bulunamadı');
    subeYetkiKontrolu(user, s.subeId);
    const guncel = await this.prisma.siparis.update({ where: { id: siparisId }, data: { durum } });
    this.realtime.siparisGuncellendi(s.subeId, {
      siparisId: guncel.id,
      adisyonId: guncel.adisyonId,
      durum: guncel.durum,
    });
    return guncel;
  }

  async listele(user: CurrentUserData, subeId?: string, durumlar?: string[]) {
    const where: any = {};
    if (subeId) {
      subeYetkiKontrolu(user, subeId);
      where.subeId = subeId;
    }
    if (durumlar?.length) where.durum = { in: durumlar };
    return this.prisma.siparis.findMany({
      where,
      include: {
        kalemler: { include: { urun: { select: { id: true, ad: true } } } },
        adisyon: { select: { id: true, numara: true, masa: { select: { id: true, ad: true } } } },
        kullanici: { select: { id: true, adSoyad: true } },
      },
      orderBy: { olusturuldu: 'asc' },
    });
  }
}
