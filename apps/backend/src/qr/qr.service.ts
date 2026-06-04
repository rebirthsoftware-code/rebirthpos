import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QrSiparisDto } from './dto/qr.dto';
import { AdisyonDurum, MasaDurum, SiparisDurum } from '../common/enums';
import { adisyonNumarasiUret, hesaplaAdisyonTutar } from '../adisyonlar/adisyon-hesap';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const QR_SISTEM_KULLANICI_EPOSTA = 'qr-system@rebirth.local';

@Injectable()
export class QrService {
  constructor(private prisma: PrismaService, private realtime: RealtimeGateway) {}

  /**
   * QR menü için public — sadece aktif + qrMenudeGoster=true ürünler.
   */
  async menu(subeId: string) {
    const sube = await this.prisma.sube.findUnique({
      where: { id: subeId },
      include: { firma: { select: { ad: true, logoUrl: true, paraBirimi: true } } },
    });
    if (!sube || !sube.aktif) throw new NotFoundException('Şube bulunamadı');

    const [kategoriler, urunler] = await Promise.all([
      this.prisma.kategori.findMany({
        where: { subeId, aktif: true },
        orderBy: [{ sira: 'asc' }, { ad: 'asc' }],
      }),
      this.prisma.urun.findMany({
        where: { subeId, aktif: true, qrMenudeGoster: true },
        orderBy: { ad: 'asc' },
      }),
    ]);

    return {
      sube: { id: sube.id, ad: sube.ad, firma: sube.firma },
      kategoriler,
      urunler,
    };
  }

  async masaBilgi(masaId: string) {
    const masa = await this.prisma.masa.findUnique({
      where: { id: masaId },
      include: { sube: { select: { id: true, ad: true } } },
    });
    if (!masa) throw new NotFoundException('Masa bulunamadı');
    return masa;
  }

  /**
   * QR menüden sipariş gelir. Akış:
   * - masaId varsa: o masanın aktif adisyonu varsa onu kullan, yoksa yeni aç
   * - masaId yoksa: yeni masasız adisyon aç (paket gibi)
   * - Sipariş + kalemleri ekle
   * - Personele anlık bildirim gönder
   */
  async siparisAl(dto: QrSiparisDto) {
    if (!dto.kalemler?.length) throw new BadRequestException('Sepet boş');

    const sube = await this.prisma.sube.findUnique({ where: { id: dto.subeId } });
    if (!sube || !sube.aktif) throw new NotFoundException('Şube bulunamadı');

    // QR sistem kullanıcısını al/oluştur
    let sistemKullanici = await this.prisma.kullanici.findUnique({
      where: { eposta: QR_SISTEM_KULLANICI_EPOSTA },
    });
    if (!sistemKullanici) {
      sistemKullanici = await this.prisma.kullanici.create({
        data: {
          eposta: QR_SISTEM_KULLANICI_EPOSTA,
          sifreHash: 'QR_SYSTEM_NO_LOGIN',
          adSoyad: 'QR Menü',
          rol: 'KASIYER',
        },
      });
    }

    // Ürünleri doğrula
    const urunIds = dto.kalemler.map((k) => k.urunId);
    const urunler = await this.prisma.urun.findMany({ where: { id: { in: urunIds } } });
    const urunMap = new Map(urunler.map((u) => [u.id, u]));
    for (const k of dto.kalemler) {
      const u = urunMap.get(k.urunId);
      if (!u || u.subeId !== dto.subeId || !u.aktif || !u.qrMenudeGoster) {
        throw new BadRequestException('Geçersiz ürün: ' + k.urunId);
      }
    }

    // Adisyon — varsa mevcudunu kullan, yoksa yeni aç
    let adisyonId: string;
    let masaId: string | null = null;
    if (dto.masaId) {
      const masa = await this.prisma.masa.findUnique({ where: { id: dto.masaId } });
      if (!masa || masa.subeId !== dto.subeId) throw new NotFoundException('Masa bulunamadı');
      masaId = masa.id;
      const aktif = await this.prisma.adisyon.findFirst({
        where: {
          masaId: masa.id,
          durum: { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR] },
        },
      });
      if (aktif) {
        adisyonId = aktif.id;
      } else {
        const bugunBaslangic = new Date();
        bugunBaslangic.setHours(0, 0, 0, 0);
        const bugunkuSayi = await this.prisma.adisyon.count({
          where: { subeId: dto.subeId, acilis: { gte: bugunBaslangic } },
        });
        const adisyon = await this.prisma.adisyon.create({
          data: {
            subeId: dto.subeId,
            masaId: masa.id,
            acanKullaniciId: sistemKullanici.id,
            numara: adisyonNumarasiUret(bugunkuSayi),
            durum: AdisyonDurum.ACIK,
          },
        });
        adisyonId = adisyon.id;
        await this.prisma.masa.update({ where: { id: masa.id }, data: { durum: MasaDurum.DOLU } });
        this.realtime.masaDurumDegisti(dto.subeId, { masaId: masa.id, durum: MasaDurum.DOLU });
      }
    } else {
      // Masasız: her QR siparişi için ayrı adisyon
      const bugunBaslangic = new Date();
      bugunBaslangic.setHours(0, 0, 0, 0);
      const bugunkuSayi = await this.prisma.adisyon.count({
        where: { subeId: dto.subeId, acilis: { gte: bugunBaslangic } },
      });
      const adisyon = await this.prisma.adisyon.create({
        data: {
          subeId: dto.subeId,
          acanKullaniciId: sistemKullanici.id,
          numara: adisyonNumarasiUret(bugunkuSayi),
          durum: AdisyonDurum.ACIK,
          not: dto.musteriAd
            ? `QR · ${dto.musteriAd}${dto.musteriTel ? ' · ' + dto.musteriTel : ''}`
            : 'QR Sipariş',
        },
      });
      adisyonId = adisyon.id;
    }

    // Sipariş + kalemler
    const siparis = await this.prisma.siparis.create({
      data: {
        subeId: dto.subeId,
        adisyonId,
        kullaniciId: sistemKullanici.id,
        kaynak: 'QR_MENU',
        not: dto.not,
        durum: SiparisDurum.ALINDI,
        kalemler: {
          create: dto.kalemler.map((k) => {
            const u = urunMap.get(k.urunId)!;
            const birim = new Prisma.Decimal(u.fiyat);
            return {
              urunId: k.urunId,
              adet: k.adet,
              birimFiyat: birim,
              toplam: birim.mul(k.adet),
              not: k.not,
            };
          }),
        },
      },
      include: { kalemler: { include: { urun: true } } },
    });

    // Adisyon tutarını güncelle
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: adisyonId },
      include: { siparisler: { include: { kalemler: { include: { urun: true } } } } },
    });
    if (adisyon) {
      const kalemler = adisyon.siparisler.flatMap((s) =>
        s.kalemler
          .filter((k) => !k.iptal)
          .map((k) => ({ adet: k.adet, birimFiyat: k.birimFiyat, urunKdvOrani: k.urun.kdvOrani })),
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

    // Personele anlık bildirim
    this.realtime.yeniSiparis(dto.subeId, {
      siparisId: siparis.id,
      adisyonId,
      masaId,
      kaynak: 'QR_MENU',
      kalemSayisi: siparis.kalemler.length,
      musteriAd: dto.musteriAd,
    });

    return {
      siparisId: siparis.id,
      adisyonId,
      numara: adisyon?.numara,
      toplam: siparis.kalemler.reduce((s, k) => s + Number(k.toplam), 0),
    };
  }
}
