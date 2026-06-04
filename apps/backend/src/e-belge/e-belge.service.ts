import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { subeYetkiKontrolu } from '../common/tenant';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';
import {
  EBelgeAlici,
  EBelgeDuzenleIstek,
  EBelgeKalem,
  EBelgeKdvSatiri,
  EBelgeOdeme,
  EBelgeTip,
  IEBelgeAdapter,
} from './e-belge.types';

export const EBELGE_ADAPTER = Symbol('EBELGE_ADAPTER');

@Injectable()
export class EBelgeService {
  constructor(
    private prisma: PrismaService,
    private denetim: DenetimService,
    @Inject(EBELGE_ADAPTER) private adapter: IEBelgeAdapter,
  ) {}

  durum() {
    return this.adapter.durum().then((d) => ({ ...d, marka: this.adapter.marka() }));
  }

  /**
   * Adisyona bağlı e-Belge düzenle (e-Arşiv, e-Fatura veya e-SMM).
   *
   * Önemli: e-Belge düzenlenince ÖKC tarafı sadece "BİLGİ FİŞİ" basar —
   * mali değer fatura belgesine geçer. Bu yüzden aynı adisyon hem ÖKC fişi
   * hem e-Belge alamaz; biri ya da öteki.
   */
  async adisyonaFaturaDuzenle(
    adisyonId: string,
    tip: EBelgeTip,
    alici: EBelgeAlici,
    not: string | undefined,
    user: CurrentUserData,
  ) {
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: adisyonId },
      include: {
        siparisler: { include: { kalemler: { include: { urun: true } } } },
        odemeler: true,
        eBelgeler: true,
      },
    });
    if (!adisyon) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, adisyon.subeId);

    // Aynı adisyona iki kez e-belge → reddet (idempotency)
    const aktifBelge = adisyon.eBelgeler.find((e) => e.durum !== 'IPTAL');
    if (aktifBelge) {
      throw new BadRequestException(
        `Bu adisyona zaten e-Belge düzenlenmiş: ${aktifBelge.belgeNo}`,
      );
    }

    if (adisyon.okcFisNo) {
      throw new BadRequestException(
        'Bu adisyona ÖKC mali fişi kesilmiş — e-Belge düzenlenemez. Önce fiş iptal edilmeli.',
      );
    }

    // Alıcı validation
    if (!alici.ad?.trim()) throw new BadRequestException('Alıcı adı zorunlu');
    if (tip === 'E_FATURA' && !alici.vergiNo?.trim()) {
      throw new BadRequestException('e-Fatura için VKN zorunludur');
    }
    if (alici.vergiNo && !/^\d{10}$|^\d{11}$/.test(alici.vergiNo.trim())) {
      throw new BadRequestException('Vergi no 10 hane VKN veya 11 hane TCKN olmalı');
    }

    // Kalemleri snapshot olarak hazırla
    const kalemler: EBelgeKalem[] = adisyon.siparisler.flatMap((s) =>
      s.kalemler
        .filter((k) => !k.iptal)
        .map((k) => ({
          ad: k.urun.ad,
          adet: k.adet,
          birimFiyat: Number(k.birimFiyat),
          kdvOrani: Number(k.urun.kdvOrani),
          toplam: Number(k.toplam),
        })),
    );

    const odemeler: EBelgeOdeme[] = adisyon.odemeler
      .filter((o) => !o.iptal)
      .map((o) => ({ tip: o.tip, tutar: Number(o.tutar) }));

    // KDV dökümü adisyonun kdvDokumu kolonundan
    let kdvDokumu: EBelgeKdvSatiri[] = [];
    if (adisyon.kdvDokumu) {
      try {
        const arr = JSON.parse(adisyon.kdvDokumu);
        kdvDokumu = arr.map((d: any) => ({
          oran: Number(d.oran),
          matrah: Number(d.matrah),
          kdv: Number(d.kdv),
        }));
      } catch {}
    }

    const toplamTutar = Number(adisyon.toplamTutar);
    const istek: EBelgeDuzenleIstek = {
      tip,
      alici,
      kalemler,
      odemeler,
      araToplam: Number(adisyon.araToplam),
      iskontoTutar: Number(adisyon.iskontoTutar),
      kdvTutar: kdvDokumu.reduce((s, d) => s + d.kdv, 0),
      toplamTutar,
      kdvDokumu,
      not,
      referans: adisyon.numara,
    };

    // Adapter'a gönder
    const yanit = await this.adapter.faturaDuzenle(istek);
    if (!yanit.basarili || !yanit.belgeNo || !yanit.ettn) {
      throw new BadRequestException(yanit.hata || 'e-Belge düzenlenemedi');
    }

    // DB'ye kaydet + audit
    const belge = await this.prisma.$transaction(async (tx) => {
      const olusan = await tx.eBelge.create({
        data: {
          subeId: adisyon.subeId,
          adisyonId: adisyon.id,
          musteriId: adisyon.musteriId,
          kullaniciId: user.kullaniciId,
          tip,
          durum: yanit.gonderildi ? 'GONDERILDI' : 'TASLAK',
          ettn: yanit.ettn!,
          belgeNo: yanit.belgeNo!,
          marka: yanit.marka || this.adapter.marka(),
          aliciAd: alici.ad,
          aliciVergiNo: alici.vergiNo || null,
          aliciVergiDairesi: alici.vergiDairesi || null,
          aliciAdres: alici.adres || null,
          aliciEposta: alici.eposta || null,
          aliciTelefon: alici.telefon || null,
          araToplam: new Prisma.Decimal(istek.araToplam),
          iskontoTutar: new Prisma.Decimal(istek.iskontoTutar),
          kdvTutar: new Prisma.Decimal(istek.kdvTutar),
          toplamTutar: new Prisma.Decimal(istek.toplamTutar),
          kdvDokumu: JSON.stringify(kdvDokumu),
          kalemler: JSON.stringify(kalemler),
          odemeler: JSON.stringify(odemeler),
          not: not || null,
          ekMeta: yanit.ham ? JSON.stringify(yanit.ham) : null,
          pdfUrl: yanit.pdfUrl || null,
          duzenlenmeTarihi: yanit.duzenlenmeTarihi ?? new Date(),
          gonderilmeTarihi: yanit.gonderildi ? new Date() : null,
        },
      });

      await this.denetim.kaydet(tx, user, {
        islem:
          tip === 'E_ARSIV'
            ? DenetimOlay.E_ARSIV_DUZENLENDI
            : tip === 'E_FATURA'
              ? DenetimOlay.E_FATURA_DUZENLENDI
              : DenetimOlay.E_SMM_DUZENLENDI,
        entityTipi: 'EBelge',
        entityId: olusan.id,
        subeId: adisyon.subeId,
        ozet: `${tip} · ${olusan.belgeNo} · ${alici.ad} · ${istek.toplamTutar.toFixed(2)}₺`,
        sonraki: {
          belgeNo: olusan.belgeNo,
          ettn: olusan.ettn,
          tip,
          adisyonId: adisyon.id,
          aliciVergiNo: alici.vergiNo,
          toplam: istek.toplamTutar,
          kdv: istek.kdvTutar,
        },
      });

      return olusan;
    });

    return {
      id: belge.id,
      belgeNo: belge.belgeNo,
      ettn: belge.ettn,
      tip: belge.tip,
      durum: belge.durum,
      marka: belge.marka,
      pdfUrl: belge.pdfUrl,
      duzenlenmeTarihi: belge.duzenlenmeTarihi,
      toplamTutar: Number(belge.toplamTutar),
      aliciAd: belge.aliciAd,
      aliciVergiNo: belge.aliciVergiNo,
    };
  }

  async listele(subeId: string | undefined, tip?: EBelgeTip, limit = 100) {
    return this.prisma.eBelge.findMany({
      where: {
        ...(subeId ? { subeId } : {}),
        ...(tip ? { tip } : {}),
      },
      orderBy: { duzenlenmeTarihi: 'desc' },
      take: limit,
      include: {
        musteri: { select: { id: true, adSoyad: true, telefon: true } },
        adisyon: { select: { id: true, numara: true } },
      },
    });
  }

  async detay(id: string, user: CurrentUserData) {
    const belge = await this.prisma.eBelge.findUnique({
      where: { id },
      include: {
        musteri: true,
        adisyon: { select: { id: true, numara: true } },
        kullanici: { select: { id: true, adSoyad: true } },
      },
    });
    if (!belge) throw new NotFoundException('e-Belge bulunamadı');
    subeYetkiKontrolu(user, belge.subeId);
    return {
      ...belge,
      kdvDokumu: belge.kdvDokumu ? JSON.parse(belge.kdvDokumu) : [],
      kalemler: belge.kalemler ? JSON.parse(belge.kalemler) : [],
      odemeler: belge.odemeler ? JSON.parse(belge.odemeler) : [],
    };
  }

  async iptal(id: string, sebep: string | undefined, user: CurrentUserData) {
    const belge = await this.prisma.eBelge.findUnique({ where: { id } });
    if (!belge) throw new NotFoundException('e-Belge bulunamadı');
    subeYetkiKontrolu(user, belge.subeId);
    if (belge.durum === 'IPTAL') throw new BadRequestException('Belge zaten iptal');

    // Adapter'a iade gönder
    const iadeYanit = await this.adapter.iade(
      belge.ettn,
      Number(belge.toplamTutar),
      sebep,
    );
    if (!iadeYanit.basarili) {
      throw new BadRequestException(iadeYanit.hata || 'İptal reddedildi');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.eBelge.update({
        where: { id },
        data: {
          durum: 'IPTAL',
          iptalTarihi: new Date(),
          ekMeta: JSON.stringify({ iade: iadeYanit, sebep }),
        },
      });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.E_BELGE_IPTAL,
        entityTipi: 'EBelge',
        entityId: id,
        subeId: belge.subeId,
        ozet: `e-Belge iptal · ${belge.belgeNo} · ${sebep || 'sebep yok'}`,
        onceki: { durum: belge.durum, belgeNo: belge.belgeNo },
        sonraki: { durum: 'IPTAL', iadeEttn: iadeYanit.iadeEttn },
      });
    });

    return { ok: true, iadeBelgeNo: iadeYanit.iadeBelgeNo, iadeEttn: iadeYanit.iadeEttn };
  }
}
