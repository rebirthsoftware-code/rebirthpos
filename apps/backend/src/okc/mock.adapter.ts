import { Injectable, Logger } from '@nestjs/common';
import {
  IOkcAdapter,
  OkcFisIstegi,
  OkcFisYaniti,
  OkcIadeIstegi,
  OkcIadeYaniti,
  OkcRaporKdvSatiri,
  OkcRaporOdemeBolumu,
  OkcXRaporu,
  OkcZRaporu,
} from './okc.types';

export type MockOkcTestMod = 'AUTO' | 'BASARI' | 'HATA';

export interface MockOkcLogKaydi {
  zaman: string;
  basarili: boolean;
  fisNo?: string;
  adisyonNo: string;
  toplamTutar: number;
  araToplam?: number;
  iskontoTutar?: number;
  kdvBandSayisi: number;
  // Detaylı KDV bantları — test panelinde tablo olarak gösterilir
  kdvDokumu: { oran: number; matrah: number; kdv: number }[];
  // Ödeme breakdown (NAKIT/KART/TICKET) — fiş üstünde kesilen tutarlar
  odemeler: { tip: string; tutar: number }[];
  // Kalem sayısı (rakam)
  kalemSayisi: number;
  // İşlem süresi (ms) — performans metrikleri için
  sureMs: number;
  hata?: string;
}

/**
 * Geliştirme + test için sahte ÖKC adapter'ı.
 * Test cihazı simülatörü için statik kontrol API'leri sunar:
 *   - testMod: AUTO (otomatik) | BASARI (her zaman onay) | HATA (her zaman red)
 *   - log: son N işlem (cihaz-test sayfasında canlı izlenir)
 *   - gecikmeMs: simülasyon gecikme süresi (gerçek cihaz ~2 sn)
 *
 * Gerçek BekoAdapter/IngenicoAdapter eklendiğinde bu dosya silinmez —
 * automatik test ve CI için kalır.
 */
@Injectable()
export class MockOkcAdapter implements IOkcAdapter {
  private readonly logger = new Logger('MockOkcAdapter');
  private sayac = Math.floor(Math.random() * 1000);

  // ── Test simulator state (process içinde tutulur) ──
  static testMod: MockOkcTestMod = 'AUTO';
  static gecikmeMs = 150;
  static log: MockOkcLogKaydi[] = [];
  static readonly maxLog = 50;
  // ── GİB raporları için kalıcı sayaçlar ──
  static zNo = 0; // Mali kapanış no — her Z'de artar
  static iadeSayac = 0;
  static sonZTarihi: Date | null = null;
  // Mali kapanış sonrası "yeni gün" başlar — sonraki Z bu noktadan toplar.
  // Z raporu alındıktan sonra log temizlenmez (denetim için saklanır) ama
  // yeni Z hesaplama "sonZTarihi"'nden itibaren olur.

  // İade kayıtları
  static iadeler: Array<{ zaman: string; orijinalFisNo: string; iadeFisNo: string; tutar: number }> = [];

  marka(): string {
    return 'MOCK';
  }

  async satisKaydet(istek: OkcFisIstegi): Promise<OkcFisYaniti> {
    const baslangic = Date.now();
    await new Promise((r) => setTimeout(r, MockOkcAdapter.gecikmeMs));

    const zaman = new Date().toISOString();
    const ortakLog = {
      zaman,
      adisyonNo: istek.adisyonNo,
      toplamTutar: istek.toplamTutar,
      araToplam: istek.araToplam,
      iskontoTutar: istek.iskontoTutar,
      kdvBandSayisi: istek.kdvDokumu.length,
      kdvDokumu: istek.kdvDokumu,
      odemeler: istek.odemeler.map((o) => ({ tip: o.tip, tutar: o.tutar })),
      kalemSayisi: istek.kalemler.length,
    };

    // KDV tutarlılık kontrolü — gerçek cihaz da reddeder
    const dokumToplam = istek.kdvDokumu.reduce(
      (s, d) => s + d.matrah + d.kdv,
      0,
    );
    if (Math.abs(dokumToplam - istek.toplamTutar) > 0.05) {
      const hata = `KDV dökümü uyuşmuyor: dokum=${dokumToplam.toFixed(2)}, toplam=${istek.toplamTutar.toFixed(2)}`;
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    if (istek.toplamTutar <= 0) {
      const hata = 'Sıfır tutarlı satış kaydedilemez';
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    // Ödeme tutar tutarlılık kontrolü
    const odemeToplam = istek.odemeler.reduce((s, o) => s + o.tutar, 0);
    if (Math.abs(odemeToplam - istek.toplamTutar) > 0.05) {
      const hata = `Ödemeler ile toplam uyuşmuyor: odeme=${odemeToplam.toFixed(2)}, toplam=${istek.toplamTutar.toFixed(2)}`;
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    // Test mod kontrolü
    if (MockOkcAdapter.testMod === 'HATA') {
      const hata = 'TEST: ÖKC cihaz zorlamalı hata modunda';
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    this.sayac++;
    const fisNo = `MOCK-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(this.sayac).padStart(6, '0')}`;
    this.logger.log(
      `Mock fiş: ${fisNo} (adisyon=${istek.adisyonNo}, ${istek.toplamTutar.toFixed(2)}₺, kdvBant=${istek.kdvDokumu.length}, odemeTip=${istek.odemeler.map((o) => o.tip).join(',')})`,
    );
    this.logEkle({ ...ortakLog, basarili: true, fisNo, sureMs: Date.now() - baslangic });

    return {
      basarili: true,
      fisNo,
      fisTarihi: new Date(),
      marka: 'MOCK',
      ham: { simulated: true, sayac: this.sayac },
    };
  }

  async durum() {
    return {
      cihazBagli: MockOkcAdapter.testMod !== 'HATA',
      aciklama: `Mock ÖKC · test mod: ${MockOkcAdapter.testMod} · gecikme: ${MockOkcAdapter.gecikmeMs}ms`,
    };
  }

  private logEkle(kayit: MockOkcLogKaydi) {
    MockOkcAdapter.log.unshift(kayit);
    if (MockOkcAdapter.log.length > MockOkcAdapter.maxLog) {
      MockOkcAdapter.log.length = MockOkcAdapter.maxLog;
    }
  }

  /**
   * X raporu: ara mali rapor. Son Z'den bu yana olan başarılı fişleri toplar.
   * Mali kapanış DEĞİLDİR — sayaçları sıfırlamaz, sadece görüntüler.
   */
  async xRaporu(): Promise<OkcXRaporu> {
    await new Promise((r) => setTimeout(r, Math.min(MockOkcAdapter.gecikmeMs, 300)));
    return this.aggregeRapor('X') as OkcXRaporu;
  }

  /**
   * Z raporu: günlük mali kapanış. Son Z'den bu yana olanları toplar,
   * zNo artırır, sonZTarihi'ni günceller. Türkiye'de günde 1 kez zorunlu.
   */
  async zRaporu(): Promise<OkcZRaporu> {
    await new Promise((r) => setTimeout(r, Math.min(MockOkcAdapter.gecikmeMs * 2, 500)));
    MockOkcAdapter.zNo++;
    const rapor = this.aggregeRapor('Z') as OkcZRaporu;
    rapor.zNo = MockOkcAdapter.zNo;
    MockOkcAdapter.sonZTarihi = rapor.bitis;
    this.logger.log(
      `Z raporu üretildi: zNo=${rapor.zNo}, fis=${rapor.fisSayisi}, toplam=${rapor.toplamSatis.toFixed(2)}₺`,
    );
    return rapor;
  }

  async iade(istek: OkcIadeIstegi): Promise<OkcIadeYaniti> {
    await new Promise((r) => setTimeout(r, Math.min(MockOkcAdapter.gecikmeMs, 300)));

    if (MockOkcAdapter.testMod === 'HATA') {
      return { basarili: false, marka: 'MOCK', hata: 'TEST: İade zorlamalı red modunda' };
    }
    if (!istek.tutar || istek.tutar <= 0) {
      return { basarili: false, marka: 'MOCK', hata: 'Geçersiz iade tutarı' };
    }
    if (!istek.orijinalFisNo) {
      return { basarili: false, marka: 'MOCK', hata: 'Orijinal fiş no gerekli' };
    }

    MockOkcAdapter.iadeSayac++;
    const iadeFisNo = `MOCK-IADE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(MockOkcAdapter.iadeSayac).padStart(6, '0')}`;
    const zaman = new Date().toISOString();

    MockOkcAdapter.iadeler.push({
      zaman,
      orijinalFisNo: istek.orijinalFisNo,
      iadeFisNo,
      tutar: istek.tutar,
    });
    this.logger.log(`İade fişi: ${iadeFisNo} (orijinal=${istek.orijinalFisNo}, ${istek.tutar.toFixed(2)}₺)`);

    return {
      basarili: true,
      iadeFisNo,
      tarih: new Date(),
      marka: 'MOCK',
    };
  }

  /**
   * Z ve X raporları için ortak aggregator. Son Z'den itibaren olan başarılı
   * fişleri tarar ve KDV bandı + ödeme tipi bazında toplamları çıkarır.
   */
  private aggregeRapor(tip: 'Z' | 'X'): OkcZRaporu | OkcXRaporu {
    const simdi = new Date();
    const sonZ = MockOkcAdapter.sonZTarihi;

    // Son Z'den bu yana olan başarılı fişler
    const kapsamFisler = MockOkcAdapter.log.filter((l) => {
      if (!l.basarili) return false;
      if (sonZ && new Date(l.zaman) <= sonZ) return false;
      return true;
    });
    const hataliFisler = MockOkcAdapter.log.filter((l) => {
      if (l.basarili) return false;
      if (sonZ && new Date(l.zaman) <= sonZ) return false;
      return true;
    });

    // İadeler (kapsam içi)
    const kapsamIadeler = MockOkcAdapter.iadeler.filter((i) => {
      if (sonZ && new Date(i.zaman) <= sonZ) return false;
      return true;
    });

    // KDV bantları aggregate
    const kdvMap = new Map<number, { matrah: number; kdv: number }>();
    let toplamSatis = 0;
    let araToplam = 0;
    let toplamIskonto = 0;

    for (const fis of kapsamFisler) {
      toplamSatis += fis.toplamTutar;
      araToplam += fis.araToplam ?? 0;
      toplamIskonto += fis.iskontoTutar ?? 0;
      for (const k of fis.kdvDokumu) {
        const mevcut = kdvMap.get(k.oran) || { matrah: 0, kdv: 0 };
        mevcut.matrah += k.matrah;
        mevcut.kdv += k.kdv;
        kdvMap.set(k.oran, mevcut);
      }
    }
    const kdvBantlari: OkcRaporKdvSatiri[] = Array.from(kdvMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([oran, v]) => ({
        oran,
        matrah: Number(v.matrah.toFixed(2)),
        kdv: Number(v.kdv.toFixed(2)),
      }));
    const toplamKdv = kdvBantlari.reduce((s, b) => s + b.kdv, 0);

    // Ödeme tipi aggregate
    const odemeMap = new Map<string, { tutar: number; fisSayisi: number }>();
    for (const fis of kapsamFisler) {
      const tipler = new Set<string>();
      for (const o of fis.odemeler) {
        const mevcut = odemeMap.get(o.tip) || { tutar: 0, fisSayisi: 0 };
        mevcut.tutar += o.tutar;
        odemeMap.set(o.tip, mevcut);
        tipler.add(o.tip);
      }
      // Her benzersiz tip için fiş sayısı artır
      for (const t of tipler) {
        const m = odemeMap.get(t)!;
        m.fisSayisi += 1;
      }
    }
    const odemeler: OkcRaporOdemeBolumu[] = Array.from(odemeMap.entries()).map(
      ([tip, v]) => ({ tip, tutar: Number(v.tutar.toFixed(2)), fisSayisi: v.fisSayisi }),
    );

    const toplamIade = kapsamIadeler.reduce((s, i) => s + i.tutar, 0);

    const ortak: OkcXRaporu = {
      raporTipi: 'X',
      marka: 'MOCK',
      uretildiTarih: simdi,
      baslama: sonZ,
      bitis: simdi,
      fisSayisi: kapsamFisler.length,
      hataliFisSayisi: hataliFisler.length,
      toplamSatis: Number(toplamSatis.toFixed(2)),
      araToplam: Number(araToplam.toFixed(2)),
      toplamKdv: Number(toplamKdv.toFixed(2)),
      toplamIskonto: Number(toplamIskonto.toFixed(2)),
      toplamIade: Number(toplamIade.toFixed(2)),
      kdvBantlari,
      odemeler,
    };

    if (tip === 'X') return ortak;
    return { ...ortak, raporTipi: 'Z', zNo: MockOkcAdapter.zNo };
  }
}
