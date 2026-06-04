import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUserData } from '../common/decorators/current-user.decorator';
import { subeYetkiKontrolu } from '../common/tenant';
import { AdisyonDurum } from '../common/enums';
import { DenetimService } from '../denetim/denetim.service';
import { DenetimOlay } from '../denetim/denetim.olay';
import { IOkcAdapter, OkcFisYaniti, OkcKdvSatiri, OkcXRaporu, OkcZRaporu } from './okc.types';

export const OKC_ADAPTER = Symbol('OKC_ADAPTER');

@Injectable()
export class OkcService {
  constructor(
    private prisma: PrismaService,
    private denetim: DenetimService,
    @Inject(OKC_ADAPTER) private adapter: IOkcAdapter,
  ) {}

  durum() {
    return this.adapter.durum().then((d) => ({ ...d, marka: this.adapter.marka() }));
  }

  /**
   * Adisyon kapatıldıktan sonra (ya da el ile) ÖKC fişini keser.
   *
   * Idempotency: aynı adisyona ikinci çağrı mevcut fiş bilgisini döner —
   * çift fiş kesilmez. ÖKC için kritik: aynı satış GİB'e iki kez gitmesin.
   */
  async satisGonder(adisyonId: string, user: CurrentUserData) {
    const adisyon = await this.prisma.adisyon.findUnique({
      where: { id: adisyonId },
      include: {
        siparisler: { include: { kalemler: { include: { urun: true } } } },
        odemeler: true,
      },
    });
    if (!adisyon) throw new NotFoundException('Adisyon bulunamadı');
    subeYetkiKontrolu(user, adisyon.subeId);

    // Idempotency — bu adisyona fiş zaten kesildiyse mevcut yanıtı dön
    if (adisyon.okcFisNo) {
      return {
        zatenKesildi: true,
        fisNo: adisyon.okcFisNo,
        fisTarihi: adisyon.okcFisTarihi,
        marka: adisyon.okcMarka,
      };
    }

    if (adisyon.durum !== AdisyonDurum.KAPALI) {
      throw new BadRequestException(
        'Sadece kapanmış adisyona fiş kesilebilir (önce ödeme tamamlansın)',
      );
    }

    if (!adisyon.kdvDokumu) {
      throw new BadRequestException(
        'Adisyon KDV dökümü hesaplanmamış — sipariş eklenmeden fiş kesilemez',
      );
    }

    let kdvDokumu: OkcKdvSatiri[];
    try {
      kdvDokumu = JSON.parse(adisyon.kdvDokumu).map((d: any) => ({
        oran: Number(d.oran),
        matrah: Number(d.matrah),
        kdv: Number(d.kdv),
      }));
    } catch {
      throw new InternalServerErrorException('kdvDokumu JSON parse hatası');
    }

    // ÖKC formatına dönüştür
    const kalemler = adisyon.siparisler.flatMap((s) =>
      s.kalemler
        .filter((k) => !k.iptal)
        .map((k) => ({
          ad: k.urun.ad,
          adet: k.adet,
          birimFiyat: Number(k.birimFiyat),
          toplam: Number(k.toplam),
          kdvOrani: Number(k.urun.kdvOrani),
        })),
    );
    const odemeler = adisyon.odemeler
      .filter((o) => !o.iptal)
      .map((o) => ({ tip: o.tip as any, tutar: Number(o.tutar) }));

    // Adapter'a gönder — gerçek cihaza veya mock'a
    let yanit: OkcFisYaniti;
    try {
      yanit = await this.adapter.satisKaydet({
        adisyonNo: adisyon.numara,
        kalemler,
        odemeler,
        kdvDokumu,
        araToplam: Number(adisyon.araToplam),
        iskontoTutar: Number(adisyon.iskontoTutar),
        toplamTutar: Number(adisyon.toplamTutar),
      });
    } catch (e: any) {
      // Adapter exception fırlatırsa fiş kesilmemiş sayılır
      throw new InternalServerErrorException(
        `ÖKC adapter hatası: ${e?.message ?? 'bilinmiyor'}`,
      );
    }

    if (!yanit.basarili || !yanit.fisNo) {
      throw new BadRequestException(yanit.hata || 'ÖKC fişi reddedildi');
    }

    // Fiş bilgisini kaydet + denetim. Unique constraint (subeId+fisNo) ile
    // çift kayıt zaten yakalanır; idempotency kontrolü erken yolda hallediyor.
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.adisyon.update({
          where: { id: adisyon.id },
          data: {
            okcFisNo: yanit.fisNo!,
            okcFisTarihi: yanit.fisTarihi ?? new Date(),
            okcMarka: yanit.marka ?? this.adapter.marka(),
          },
        });
        // Aynı fişi tüm ödemelere de yansıt — fiş-ödeme bağı raporlarda işe yarar
        await tx.odeme.updateMany({
          where: { adisyonId: adisyon.id, iptal: false, okcFisNo: null },
          data: { okcFisNo: yanit.fisNo! },
        });
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.OKC_FIS_KESILDI,
          entityTipi: 'Adisyon',
          entityId: adisyon.id,
          subeId: adisyon.subeId,
          ozet: `Fiş kesildi: ${yanit.fisNo} (${yanit.marka}) — adisyon ${adisyon.numara}`,
          sonraki: {
            fisNo: yanit.fisNo,
            marka: yanit.marka,
            toplamTutar: Number(adisyon.toplamTutar),
            kdvDokumu,
          },
        });
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        // Race: paralel istek aynı fişi yazdı — mevcut kaydı oku ve dön
        const son = await this.prisma.adisyon.findUnique({
          where: { id: adisyon.id },
          select: { okcFisNo: true, okcFisTarihi: true, okcMarka: true },
        });
        if (son?.okcFisNo) {
          return {
            zatenKesildi: true,
            fisNo: son.okcFisNo,
            fisTarihi: son.okcFisTarihi,
            marka: son.okcMarka,
          };
        }
      }
      throw e;
    }

    return {
      zatenKesildi: false,
      fisNo: yanit.fisNo,
      fisTarihi: yanit.fisTarihi,
      marka: yanit.marka,
      kdvDokumu,
      toplamTutar: Number(adisyon.toplamTutar),
    };
  }

  /**
   * Ödeme bazında fiş kesme — restoran/cafe split-bill senaryolarında her
   * ödeme kendi mali fişine sahip olur. KART = kart tutarına özel fiş, NAKIT
   * = nakit tutarına özel fiş. KDV bantları orijinal adisyondaki oranlara
   * GÖRE ORANTISAL dağıtılır.
   *
   * Idempotency: aynı ödemeye ikinci çağrı mevcut fiş bilgisini döner.
   */
  async odemeFisiKes(odemeId: string, user: CurrentUserData) {
    const odeme = await this.prisma.odeme.findUnique({
      where: { id: odemeId },
      include: {
        adisyon: {
          include: { siparisler: { include: { kalemler: { include: { urun: true } } } } },
        },
      },
    });
    if (!odeme) throw new NotFoundException('Ödeme bulunamadı');
    subeYetkiKontrolu(user, odeme.subeId);

    // Idempotency: bu ödeme için fiş zaten kesildiyse onu dön
    if (odeme.okcFisNo) {
      return {
        zatenKesildi: true,
        fisNo: odeme.okcFisNo,
        odemeId: odeme.id,
        marka: this.adapter.marka(),
      };
    }

    if (odeme.iptal) {
      throw new BadRequestException('İptal edilmiş ödemeye fiş kesilemez');
    }

    const odemeTutar = Number(odeme.tutar);
    const adisyonToplam = Number(odeme.adisyon.toplamTutar);
    if (odemeTutar <= 0) {
      throw new BadRequestException('Sıfır tutarlı ödemeye fiş kesilemez');
    }

    // Orantı katsayısı (örn. 180/27000 = 0.00667)
    const oran = odemeTutar / adisyonToplam;

    // Adisyondaki kalemleri ORANSAL miktarla yansıt — fişin item listesi
    // tahsilatın payını gösterir. Birim fiyat aynı, adet × oran (kesirli olabilir)
    // veya toplam tutarın yüzdesi olarak. Pratik yaklaşım: tek "Tahsilat" satırı
    // değil, gerçek kalem listesini ÖKC'ye orantısal toplamla gönder.
    const kalemler = odeme.adisyon.siparisler.flatMap((s) =>
      s.kalemler
        .filter((k) => !k.iptal)
        .map((k) => ({
          ad: k.urun.ad,
          adet: k.adet, // adet dolu, görsel doğru
          birimFiyat: Number(k.birimFiyat),
          // toplam orantılı — fiş matematiği tutsun diye
          toplam: Number((Number(k.toplam) * oran).toFixed(2)),
          kdvOrani: Number(k.urun.kdvOrani),
        })),
    );

    // KDV dökümü orantısal dağıt — adisyon kdvDokumu üzerinden
    let kdvDokumu: OkcKdvSatiri[] = [];
    if (odeme.adisyon.kdvDokumu) {
      try {
        const adisyonDokum = JSON.parse(odeme.adisyon.kdvDokumu) as Array<{ oran: number; matrah: number; kdv: number }>;
        kdvDokumu = adisyonDokum.map((d) => ({
          oran: Number(d.oran),
          matrah: Number((Number(d.matrah) * oran).toFixed(2)),
          kdv: Number((Number(d.kdv) * oran).toFixed(2)),
        }));
      } catch {
        kdvDokumu = [];
      }
    }

    // Toplam matrah+kdv'ye yuvarlama hatası eklenebilir; düzelt
    const dokumToplam = kdvDokumu.reduce((s, d) => s + d.matrah + d.kdv, 0);
    const fark = odemeTutar - dokumToplam;
    if (Math.abs(fark) > 0.01 && kdvDokumu.length > 0) {
      // Farkı son bantın matrahına ekle (KDV'yi de yeniden hesapla)
      const son = kdvDokumu[kdvDokumu.length - 1];
      const oranBolen = 1 + son.oran / 100;
      const yeniMatrah = Number((son.matrah + fark / oranBolen).toFixed(2));
      son.matrah = yeniMatrah;
      son.kdv = Number((odemeTutar - kdvDokumu.reduce((s, d) => s + d.matrah, 0) - kdvDokumu.slice(0, -1).reduce((s, d) => s + d.kdv, 0)).toFixed(2));
    }

    // Yanıt — adapter'a gönder. Tek ödeme tipinde tek satır.
    let yanit: OkcFisYaniti;
    try {
      yanit = await this.adapter.satisKaydet({
        adisyonNo: `${odeme.adisyon.numara}-O${odeme.id.slice(-4).toUpperCase()}`,
        kalemler,
        odemeler: [{ tip: odeme.tip as any, tutar: odemeTutar }],
        kdvDokumu,
        araToplam: Number(kdvDokumu.reduce((s, d) => s + d.matrah, 0).toFixed(2)),
        iskontoTutar: 0,
        toplamTutar: odemeTutar,
      });
    } catch (e: any) {
      throw new InternalServerErrorException(`ÖKC adapter hatası: ${e?.message ?? 'bilinmiyor'}`);
    }

    if (!yanit.basarili || !yanit.fisNo) {
      throw new BadRequestException(yanit.hata || 'ÖKC fişi reddedildi');
    }

    // Fiş no'yu ödemeye yaz + audit
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.odeme.update({
          where: { id: odeme.id },
          data: { okcFisNo: yanit.fisNo! },
        });
        await this.denetim.kaydet(tx, user, {
          islem: DenetimOlay.OKC_FIS_KESILDI,
          entityTipi: 'Odeme',
          entityId: odeme.id,
          subeId: odeme.subeId,
          ozet: `Ödeme fişi · ${yanit.fisNo} (${yanit.marka}) · ${odeme.tip} · ${odemeTutar.toFixed(2)}₺`,
          sonraki: {
            fisNo: yanit.fisNo,
            marka: yanit.marka,
            tutar: odemeTutar,
            tip: odeme.tip,
            adisyonId: odeme.adisyonId,
            kdvDokumu,
          },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const son = await this.prisma.odeme.findUnique({
          where: { id: odeme.id },
          select: { okcFisNo: true },
        });
        if (son?.okcFisNo) {
          return { zatenKesildi: true, fisNo: son.okcFisNo, odemeId: odeme.id, marka: yanit.marka };
        }
      }
      throw e;
    }

    return {
      zatenKesildi: false,
      odemeId: odeme.id,
      fisNo: yanit.fisNo,
      fisTarihi: yanit.fisTarihi,
      marka: yanit.marka,
      kdvDokumu,
      toplamTutar: odemeTutar,
      odemeTip: odeme.tip,
    };
  }

  /**
   * X raporu: ara mali rapor. Mali kapanış değil — sayaçları sıfırlamaz.
   * Yönetici her zaman alabilir.
   */
  async xRaporuAl(user: CurrentUserData, subeId?: string): Promise<OkcXRaporu> {
    const rapor = await this.adapter.xRaporu();
    await this.prisma.$transaction(async (tx) => {
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.OKC_X_RAPORU,
        entityTipi: 'OkcRapor',
        subeId,
        ozet: `X raporu · ${rapor.fisSayisi} fiş · ${rapor.toplamSatis.toFixed(2)}₺`,
        sonraki: {
          fisSayisi: rapor.fisSayisi,
          toplamSatis: rapor.toplamSatis,
          toplamKdv: rapor.toplamKdv,
          marka: rapor.marka,
        },
      });
    });
    return rapor;
  }

  /**
   * Z raporu: günlük mali kapanış. Türkiye'de günde 1 kez alınması zorunlu.
   * Sayaçları artırır ve sonraki Z için yeni dönemi başlatır.
   */
  async zRaporuAl(user: CurrentUserData, subeId?: string): Promise<OkcZRaporu> {
    const rapor = await this.adapter.zRaporu();
    await this.prisma.$transaction(async (tx) => {
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.OKC_Z_RAPORU,
        entityTipi: 'OkcRapor',
        entityId: String(rapor.zNo),
        subeId,
        ozet: `Z raporu #${rapor.zNo} · mali kapanış · ${rapor.fisSayisi} fiş · ${rapor.toplamSatis.toFixed(2)}₺`,
        sonraki: {
          zNo: rapor.zNo,
          fisSayisi: rapor.fisSayisi,
          toplamSatis: rapor.toplamSatis,
          toplamKdv: rapor.toplamKdv,
          kdvBantlari: rapor.kdvBantlari,
          odemeler: rapor.odemeler,
          marka: rapor.marka,
        },
      });
    });
    return rapor;
  }

  /**
   * Ödeme iadesi → ÖKC üzerinde iade fişi keser.
   * Orijinal ödemenin fişNo'su ile cihaza gider, geriye iade slipi döner.
   */
  async iade(odemeId: string, tutar: number | undefined, user: CurrentUserData) {
    const odeme = await this.prisma.odeme.findUnique({
      where: { id: odemeId },
      include: { adisyon: true },
    });
    if (!odeme) throw new NotFoundException('Ödeme bulunamadı');
    subeYetkiKontrolu(user, odeme.subeId);

    if (!odeme.okcFisNo && !odeme.adisyon.okcFisNo) {
      throw new BadRequestException('Bu ödemeye karşılık ÖKC fişi yok, iade edilemez');
    }
    if (odeme.iptal) {
      throw new BadRequestException('Ödeme zaten iptal edilmiş');
    }

    const iadeTutar = tutar ?? Number(odeme.tutar);
    if (iadeTutar <= 0) throw new BadRequestException('İade tutarı sıfırdan büyük olmalı');
    if (iadeTutar > Number(odeme.tutar) + 0.01) {
      throw new BadRequestException(
        `İade tutarı ödeme tutarını aşıyor (ödeme: ${Number(odeme.tutar).toFixed(2)}₺)`,
      );
    }

    const orijinalFisNo = odeme.okcFisNo || odeme.adisyon.okcFisNo || '';
    const yanit = await this.adapter.iade({
      orijinalFisNo,
      tutar: iadeTutar,
      aciklama: `Ödeme ${odemeId} iadesi`,
    });
    if (!yanit.basarili) {
      throw new BadRequestException(yanit.hata || 'İade reddedildi');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.odeme.update({
        where: { id: odemeId },
        data: { iptal: true },
      });
      await this.denetim.kaydet(tx, user, {
        islem: DenetimOlay.OKC_IADE,
        entityTipi: 'Odeme',
        entityId: odemeId,
        subeId: odeme.subeId,
        ozet: `İade · ${iadeTutar.toFixed(2)}₺ · fiş ${yanit.iadeFisNo}`,
        onceki: { tutar: Number(odeme.tutar), tip: odeme.tip, fisNo: orijinalFisNo },
        sonraki: { iadeTutar, iadeFisNo: yanit.iadeFisNo, marka: yanit.marka },
      });
    });

    return yanit;
  }
}
