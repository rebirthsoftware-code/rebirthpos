import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EBelgeDuzenleIstek,
  EBelgeDuzenleYanit,
  EBelgeIadeYanit,
  IEBelgeAdapter,
} from './e-belge.types';

export type EBelgeTestMod = 'AUTO' | 'BASARI' | 'HATA';

export interface MockEBelgeLogKaydi {
  zaman: string;
  basarili: boolean;
  tip: string;
  belgeNo?: string;
  ettn?: string;
  aliciAd: string;
  aliciVergiNo?: string;
  toplamTutar: number;
  kdvTutar: number;
  sureMs: number;
  hata?: string;
}

/**
 * Geliştirme + test için sahte e-Belge entegratörü.
 * Gerçek entegratör (Logo/EFinans/Uyumsoft) gelene kadar tüm akış çalışır.
 *
 * GİB standardına uygun:
 *   - ETTN: 32 karakter hex (UUID v4 hyphen'sız)
 *   - Belge No: TipKod + YYYY + 9 hane sıra (örn. ER2026000000001)
 *   - Durum: TASLAK → GONDERILDI → ONAYLANDI akışı simüle edilir
 */
@Injectable()
export class MockEBelgeAdapter implements IEBelgeAdapter {
  private readonly logger = new Logger('MockEBelgeAdapter');
  private sayac: Record<string, number> = { E_ARSIV: 0, E_FATURA: 0, E_SMM: 0 };

  static testMod: EBelgeTestMod = 'AUTO';
  static gecikmeMs = 400;
  static log: MockEBelgeLogKaydi[] = [];
  static readonly maxLog = 100;

  marka(): string {
    return 'MOCK';
  }

  async durum() {
    return {
      baglandi: MockEBelgeAdapter.testMod !== 'HATA',
      aciklama: `Mock e-Belge entegratörü · test mod: ${MockEBelgeAdapter.testMod} · gecikme: ${MockEBelgeAdapter.gecikmeMs}ms`,
    };
  }

  async faturaDuzenle(istek: EBelgeDuzenleIstek): Promise<EBelgeDuzenleYanit> {
    const baslangic = Date.now();
    await new Promise((r) => setTimeout(r, MockEBelgeAdapter.gecikmeMs));
    const zaman = new Date().toISOString();

    // Tutarlılık kontrolü
    const dokumToplam = istek.kdvDokumu.reduce((s, d) => s + d.matrah + d.kdv, 0);
    if (Math.abs(dokumToplam - istek.toplamTutar) > 0.05) {
      const hata = `KDV dökümü uyuşmuyor: dokum=${dokumToplam.toFixed(2)}, toplam=${istek.toplamTutar.toFixed(2)}`;
      this.logEkle({ zaman, basarili: false, tip: istek.tip, aliciAd: istek.alici.ad, aliciVergiNo: istek.alici.vergiNo, toplamTutar: istek.toplamTutar, kdvTutar: istek.kdvTutar, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    if (istek.toplamTutar <= 0) {
      const hata = 'Sıfır tutarlı belge düzenlenemez';
      this.logEkle({ zaman, basarili: false, tip: istek.tip, aliciAd: istek.alici.ad, aliciVergiNo: istek.alici.vergiNo, toplamTutar: istek.toplamTutar, kdvTutar: istek.kdvTutar, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    // e-Fatura için VKN şart (B2B)
    if (istek.tip === 'E_FATURA' && !istek.alici.vergiNo) {
      const hata = 'e-Fatura için VKN zorunludur';
      this.logEkle({ zaman, basarili: false, tip: istek.tip, aliciAd: istek.alici.ad, toplamTutar: istek.toplamTutar, kdvTutar: istek.kdvTutar, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    // VKN/TCKN format kontrolü (basit)
    if (istek.alici.vergiNo) {
      const vn = istek.alici.vergiNo.trim();
      if (!/^\d{10}$|^\d{11}$/.test(vn)) {
        const hata = `Vergi no formatı geçersiz (10 hane VKN veya 11 hane TCKN olmalı): ${vn}`;
        this.logEkle({ zaman, basarili: false, tip: istek.tip, aliciAd: istek.alici.ad, aliciVergiNo: vn, toplamTutar: istek.toplamTutar, kdvTutar: istek.kdvTutar, sureMs: Date.now() - baslangic, hata });
        return { basarili: false, marka: 'MOCK', hata };
      }
    }

    // Test mod hata
    if (MockEBelgeAdapter.testMod === 'HATA') {
      const hata = 'TEST: e-Belge zorlamalı red modunda';
      this.logEkle({ zaman, basarili: false, tip: istek.tip, aliciAd: istek.alici.ad, aliciVergiNo: istek.alici.vergiNo, toplamTutar: istek.toplamTutar, kdvTutar: istek.kdvTutar, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, marka: 'MOCK', hata };
    }

    // ETTN: UUID v4 hyphen'sız
    const ettn = randomUUID().replace(/-/g, '').toUpperCase();

    // Belge no: TipKod + YYYY + 9 hane sıra
    this.sayac[istek.tip]++;
    const yil = new Date().getFullYear();
    const kod = istek.tip === 'E_ARSIV' ? 'ER' : istek.tip === 'E_FATURA' ? 'EF' : 'SM';
    const belgeNo = `${kod}${yil}${String(this.sayac[istek.tip]).padStart(9, '0')}`;

    this.logger.log(
      `Mock e-Belge: ${belgeNo} (${istek.tip}, ${istek.toplamTutar.toFixed(2)}₺, alıcı=${istek.alici.ad}, vergiNo=${istek.alici.vergiNo || '-'})`,
    );

    this.logEkle({
      zaman,
      basarili: true,
      tip: istek.tip,
      belgeNo,
      ettn,
      aliciAd: istek.alici.ad,
      aliciVergiNo: istek.alici.vergiNo,
      toplamTutar: istek.toplamTutar,
      kdvTutar: istek.kdvTutar,
      sureMs: Date.now() - baslangic,
    });

    return {
      basarili: true,
      belgeNo,
      ettn,
      marka: 'MOCK',
      gonderildi: true,
      duzenlenmeTarihi: new Date(),
      pdfUrl: null as any, // İleride gerçek entegratörde URL döner
      ham: { simulated: true, sayac: this.sayac[istek.tip] },
    };
  }

  async iade(orijinalEttn: string, tutar: number, sebep?: string): Promise<EBelgeIadeYanit> {
    await new Promise((r) => setTimeout(r, Math.min(MockEBelgeAdapter.gecikmeMs, 300)));
    if (MockEBelgeAdapter.testMod === 'HATA') {
      return { basarili: false, hata: 'TEST: İade zorlamalı red' };
    }
    if (!orijinalEttn || !tutar || tutar <= 0) {
      return { basarili: false, hata: 'Geçersiz iade parametreleri' };
    }
    const iadeEttn = randomUUID().replace(/-/g, '').toUpperCase();
    this.sayac.E_ARSIV++;
    const yil = new Date().getFullYear();
    const belgeNo = `ER${yil}${String(this.sayac.E_ARSIV).padStart(9, '0')}`;
    this.logger.log(`Mock e-Belge iade: ${belgeNo} (orijinal=${orijinalEttn}, ${tutar.toFixed(2)}₺)`);
    return { basarili: true, iadeBelgeNo: belgeNo, iadeEttn };
  }

  private logEkle(kayit: MockEBelgeLogKaydi) {
    MockEBelgeAdapter.log.unshift(kayit);
    if (MockEBelgeAdapter.log.length > MockEBelgeAdapter.maxLog) {
      MockEBelgeAdapter.log.length = MockEBelgeAdapter.maxLog;
    }
  }
}
