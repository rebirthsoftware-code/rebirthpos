import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { QrOdemeBaslatDto, QrOdemeSonucDto, QrSiparisDto } from './dto/qr.dto';
import { AdisyonDurum, MasaDurum, OdemeTipi, SiparisDurum } from '../common/enums';
import { adisyonNumarasiUret, hesaplaAdisyonTutar } from '../adisyonlar/adisyon-hesap';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PaytrService } from '../paytr/paytr.service';

const QR_SISTEM_KULLANICI_EPOSTA = 'qr-system@rebirth.local';

@Injectable()
export class QrService {
  constructor(
    private prisma: PrismaService,
    private realtime: RealtimeGateway,
    private paytr: PaytrService,
  ) {}

  /** QR sistem kullanıcısını al/oluştur — sipariş ve ödemelerde sahip olarak kullanılır. */
  private async sistemKullaniciAl() {
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
    return sistemKullanici;
  }

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
    const sistemKullanici = await this.sistemKullaniciAl();

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

  /**
   * Masanın güncel açık hesabını döner — müşteri QR'dan kendi hesabını görüp
   * ödeyebilsin diye. Aktif adisyon yoksa { bos: true } döner (hata değil).
   */
  async masaHesap(masaId: string) {
    const masa = await this.prisma.masa.findUnique({
      where: { id: masaId },
      include: { sube: { include: { firma: { select: { ad: true, paraBirimi: true } } } } },
    });
    if (!masa) throw new NotFoundException('Masa bulunamadı');

    const adisyon = await this.prisma.adisyon.findFirst({
      where: {
        masaId: masa.id,
        durum: { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR] },
      },
      orderBy: { acilis: 'desc' },
      include: {
        odemeler: true,
        siparisler: { include: { kalemler: { include: { urun: { select: { ad: true } } } } } },
      },
    });

    const ortak = {
      masa: { id: masa.id, ad: masa.ad },
      sube: { id: masa.sube.id, ad: masa.sube.ad },
      firma: { ad: masa.sube.firma.ad, paraBirimi: masa.sube.firma.paraBirimi },
    };

    if (!adisyon) {
      return { ...ortak, bos: true };
    }

    // Kalemleri ürün+fiyat+not bazında grupla (görsel sade hesap dökümü)
    const kalemMap = new Map<string, { ad: string; adet: number; birimFiyat: number; toplam: number }>();
    for (const s of adisyon.siparisler) {
      for (const k of s.kalemler) {
        if (k.iptal) continue;
        const anahtar = `${k.urunId}|${Number(k.birimFiyat)}`;
        const mevcut = kalemMap.get(anahtar);
        if (mevcut) {
          mevcut.adet += k.adet;
          mevcut.toplam += Number(k.toplam);
        } else {
          kalemMap.set(anahtar, {
            ad: k.urun.ad,
            adet: k.adet,
            birimFiyat: Number(k.birimFiyat),
            toplam: Number(k.toplam),
          });
        }
      }
    }

    const odenen = adisyon.odemeler
      .filter((o) => !o.iptal)
      .reduce((acc, o) => acc.add(o.tutar), new Prisma.Decimal(0));
    const toplam = new Prisma.Decimal(adisyon.toplamTutar);
    const kalan = toplam.sub(odenen);

    return {
      ...ortak,
      bos: false,
      adisyonId: adisyon.id,
      numara: adisyon.numara,
      durum: adisyon.durum,
      kalemler: Array.from(kalemMap.values()),
      araToplam: Number(adisyon.araToplam),
      kdvTutar: Number(adisyon.kdvTutar),
      toplamTutar: Number(toplam),
      odenenTutar: Number(odenen),
      kalanTutar: Number(kalan.lt(0) ? 0 : kalan),
    };
  }

  /** Bir adisyonun kalan tutarını (ödenmemiş bakiye) güvenli şekilde hesaplar. */
  private async adisyonKalan(adisyonId: string, subeId: string) {
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: adisyonId },
      include: { odemeler: true },
    });
    if (!adisyon || adisyon.subeId !== subeId) throw new NotFoundException('Adisyon bulunamadı');
    if (adisyon.durum === AdisyonDurum.KAPALI || adisyon.durum === AdisyonDurum.IPTAL) {
      throw new BadRequestException('Bu hesap kapanmış, ödeme alınamaz');
    }
    const odenen = adisyon.odemeler
      .filter((o) => !o.iptal)
      .reduce((acc, o) => acc.add(o.tutar), new Prisma.Decimal(0));
    const kalan = new Prisma.Decimal(adisyon.toplamTutar).sub(odenen);
    return { adisyon, kalan };
  }

  /**
   * PayTR sanal pos ödeme oturumunu başlatır. Önce kalan bakiyeyi doğrular,
   * sonra adapter'dan token alır. Gerçek tahsilat /qr/odeme/sonuc'ta olur.
   */
  async odemeBaslat(dto: QrOdemeBaslatDto) {
    const { adisyon, kalan } = await this.adisyonKalan(dto.adisyonId, dto.subeId);
    if (new Prisma.Decimal(dto.tutar).gt(kalan.add(0.01))) {
      throw new BadRequestException(`Tutar kalan bakiyeyi aşıyor (kalan: ${kalan.toFixed(2)})`);
    }

    const yanit = await this.paytr.odemeBaslat({
      tutar: dto.tutar,
      adisyonId: adisyon.id,
      subeId: dto.subeId,
      musteriAd: dto.musteriAd,
      musteriEposta: dto.musteriEposta,
      musteriTel: dto.musteriTel,
      siparisNo: adisyon.numara,
    });

    return {
      token: yanit.token,
      odemeUrl: yanit.odemeUrl ?? null,
      saglayici: yanit.saglayici,
      testMod: yanit.testMod ?? null,
      adisyonId: adisyon.id,
      tutar: dto.tutar,
    };
  }

  /**
   * PayTR sanal pos sonucunu işler. Onaylandıysa Odeme (tip SANAL_POS) kaydı
   * oluşturur; hesap tamamen ödendiyse adisyonu kapatır, masayı boşaltır.
   * Tutar tahsilattan önce tekrar doğrulanır (kalan bakiye kontrolü).
   */
  async odemeSonuc(dto: QrOdemeSonucDto) {
    // Önce kalanı doğrula — tahsilat öncesi (banka ekranı açıkken hesap kapanmış olabilir)
    await this.adisyonKalan(dto.adisyonId, dto.subeId);

    const sonuc = await this.paytr.sonucDogrula({ token: dto.token, basariliMi: dto.basariliMi });
    if (!sonuc.basarili) {
      return { basarili: false, durum: sonuc.durum, hata: sonuc.hata || 'Ödeme onaylanmadı' };
    }

    const sistemKullanici = await this.sistemKullaniciAl();

    const islem = await this.prisma.$transaction(async (tx) => {
      const adisyon = await tx.adisyon.findUnique({
        where: { id: dto.adisyonId },
        include: { odemeler: true },
      });
      if (!adisyon || adisyon.subeId !== dto.subeId) throw new NotFoundException('Adisyon bulunamadı');
      if (adisyon.durum === AdisyonDurum.KAPALI || adisyon.durum === AdisyonDurum.IPTAL) {
        throw new BadRequestException('Bu hesap kapanmış, ödeme alınamaz');
      }

      const odenmis = adisyon.odemeler
        .filter((o) => !o.iptal)
        .reduce((acc, o) => acc.add(o.tutar), new Prisma.Decimal(0));
      const kalan = new Prisma.Decimal(adisyon.toplamTutar).sub(odenmis);
      if (new Prisma.Decimal(dto.tutar).gt(kalan.add(0.01))) {
        throw new BadRequestException(`Tutar kalan bakiyeyi aşıyor (kalan: ${kalan.toFixed(2)})`);
      }

      const odeme = await tx.odeme.create({
        data: {
          subeId: adisyon.subeId,
          adisyonId: adisyon.id,
          kullaniciId: sistemKullanici.id,
          tip: OdemeTipi.SANAL_POS,
          tutar: new Prisma.Decimal(dto.tutar),
          kartMeta: JSON.stringify({
            saglayici: sonuc.saglayici,
            islemNo: sonuc.islemNo,
            token: dto.token,
            kaynak: 'QR_PAYTR',
          }),
        },
      });

      const yeniOdenmis = odenmis.add(dto.tutar);
      let yeniDurum: string = AdisyonDurum.ODEME_BEKLIYOR;
      let masaYeniDurum: string | null = null;
      if (yeniOdenmis.gte(new Prisma.Decimal(adisyon.toplamTutar).sub(0.01))) {
        await tx.adisyon.update({
          where: { id: adisyon.id },
          data: { durum: AdisyonDurum.KAPALI, kapanis: new Date() },
        });
        yeniDurum = AdisyonDurum.KAPALI;
        if (adisyon.masaId) {
          await tx.masa.update({ where: { id: adisyon.masaId }, data: { durum: MasaDurum.BOS } });
          masaYeniDurum = MasaDurum.BOS;
        }
      } else {
        await tx.adisyon.update({
          where: { id: adisyon.id },
          data: { durum: AdisyonDurum.ODEME_BEKLIYOR },
        });
      }

      return {
        odeme,
        yeniDurum,
        masaYeniDurum,
        odenenToplam: yeniOdenmis.toNumber(),
        kalanTutar: Math.max(0, new Prisma.Decimal(adisyon.toplamTutar).sub(yeniOdenmis).toNumber()),
        masaId: adisyon.masaId,
        subeId: adisyon.subeId,
      };
    });

    // Yan etkiler transaction dışında — personel paneline bildir
    this.realtime.odemeAlindi(islem.subeId, {
      odemeId: islem.odeme.id,
      adisyonId: islem.odeme.adisyonId,
      tutar: Number(islem.odeme.tutar),
      tip: islem.odeme.tip,
    });
    this.realtime.adisyonGuncellendi(islem.subeId, {
      adisyonId: islem.odeme.adisyonId,
      durum: islem.yeniDurum,
      odenenToplam: islem.odenenToplam,
    });
    if (islem.masaYeniDurum && islem.masaId) {
      this.realtime.masaDurumDegisti(islem.subeId, { masaId: islem.masaId, durum: islem.masaYeniDurum });
    }

    return {
      basarili: true,
      durum: 'ONAYLANDI' as const,
      odemeId: islem.odeme.id,
      islemNo: sonuc.islemNo,
      adisyonDurum: islem.yeniDurum,
      odenenTutar: Number(islem.odeme.tutar),
      kalanTutar: islem.kalanTutar,
    };
  }
}
