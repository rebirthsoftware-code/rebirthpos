import { Injectable } from '@nestjs/common';
import {
  IPaytrAdapter,
  PaytrOdemeBaslatIstegi,
  PaytrOdemeBaslatYaniti,
  PaytrSonucIstegi,
  PaytrSonucYaniti,
} from './paytr.types';

export type MockPaytrTestMod = 'AUTO' | 'BASARI' | 'HATA';

export interface MockPaytrLogKaydi {
  zaman: string;
  islem: 'BASLAT' | 'SONUC';
  basarili: boolean;
  tutar?: number;
  token?: string;
  siparisNo?: string;
  islemNo?: string;
  musteriAd?: string;
  // İşlem süresi (ms)
  sureMs: number;
  hata?: string;
}

function rnd(uzunluk: number): string {
  let s = '';
  while (s.length < uzunluk) s += Math.random().toString(36).slice(2);
  return s.slice(0, uzunluk).toUpperCase();
}

/**
 * Geliştirme + test için PayTR Sanal POS mock'u. Gerçek entegre bilgileri
 * (merchant_id/key/salt) gelene kadar tüm online ödeme akışı bu mock üzerinden
 * çalışır. Cihaz-test sayfasından kontrol edilir:
 *   - testMod: AUTO (rastgele %95 onay) | BASARI (her zaman onay) | HATA (her zaman red)
 *   - gecikmeMs: banka/3D-secure simülasyon gecikmesi
 *   - log: son N işlem
 *
 * odemeBaslat sadece bir token üretir; odemeUrl boş döner çünkü gerçek PayTR
 * iframe'i yerine frontend kendi /qr/odeme-test sayfasını açar.
 */
@Injectable()
export class MockPaytrAdapter implements IPaytrAdapter {
  static testMod: MockPaytrTestMod = 'AUTO';
  static gecikmeMs = 1500;
  static log: MockPaytrLogKaydi[] = [];
  static readonly maxLog = 50;

  saglayici(): string {
    return 'MOCK';
  }

  async durum(): Promise<{ hazir: boolean; aciklama: string }> {
    return {
      hazir: MockPaytrAdapter.testMod !== 'HATA',
      aciklama: `Mock PayTR Sanal POS · test mod: ${MockPaytrAdapter.testMod} · gecikme: ${MockPaytrAdapter.gecikmeMs}ms (entegre bilgileri henüz yok)`,
    };
  }

  async odemeBaslat(istek: PaytrOdemeBaslatIstegi): Promise<PaytrOdemeBaslatYaniti> {
    const baslangic = Date.now();
    const zaman = new Date().toISOString();

    if (!Number.isFinite(istek.tutar) || istek.tutar <= 0) {
      const hata = 'Geçersiz tutar';
      this.logEkle({ zaman, islem: 'BASLAT', basarili: false, tutar: istek.tutar, siparisNo: istek.siparisNo, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, saglayici: this.saglayici(), hata };
    }

    if (MockPaytrAdapter.testMod === 'HATA') {
      const hata = 'TEST: Sanal POS zorlamalı red modunda — token alınamadı';
      this.logEkle({ zaman, islem: 'BASLAT', basarili: false, tutar: istek.tutar, siparisNo: istek.siparisNo, musteriAd: istek.musteriAd, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, saglayici: this.saglayici(), testMod: MockPaytrAdapter.testMod, hata };
    }

    // PayTR token'ı: gerçekte 64 karakter base64; mock için benzeri bir dizge.
    const token = `PAYTR-MOCK-${rnd(40)}`;
    this.logEkle({
      zaman,
      islem: 'BASLAT',
      basarili: true,
      tutar: istek.tutar,
      token,
      siparisNo: istek.siparisNo,
      musteriAd: istek.musteriAd,
      sureMs: Date.now() - baslangic,
    });
    return {
      basarili: true,
      token,
      // MOCK: gerçek iframe URL'i yok — frontend test ödeme sayfasını açar.
      odemeUrl: undefined,
      saglayici: this.saglayici(),
      testMod: MockPaytrAdapter.testMod,
    };
  }

  async sonucDogrula(istek: PaytrSonucIstegi): Promise<PaytrSonucYaniti> {
    const baslangic = Date.now();
    // 3D-secure ekranı gecikmesini simüle et
    await new Promise((r) => setTimeout(r, MockPaytrAdapter.gecikmeMs));
    const zaman = new Date().toISOString();

    let onay: boolean;
    let hata: string | undefined;
    if (MockPaytrAdapter.testMod === 'HATA') {
      onay = false;
      hata = 'TEST: Sanal POS zorlamalı red modunda';
    } else if (MockPaytrAdapter.testMod === 'BASARI') {
      onay = true;
    } else {
      // AUTO: müşterinin ekranda seçtiği sonuca uy; seçmediyse %95 onay.
      if (istek.basariliMi === false) {
        onay = false;
        hata = 'Müşteri ödemeyi iptal etti / banka reddetti';
      } else if (istek.basariliMi === true) {
        onay = Math.random() < 0.95;
        if (!onay) hata = 'Banka işlemi reddetti (3D doğrulama başarısız)';
      } else {
        onay = Math.random() < 0.95;
        if (!onay) hata = 'Banka işlemi reddetti';
      }
    }

    const islemNo = onay ? `PT${rnd(12)}` : undefined;
    this.logEkle({
      zaman,
      islem: 'SONUC',
      basarili: onay,
      token: istek.token,
      islemNo,
      sureMs: Date.now() - baslangic,
      hata,
    });
    return {
      basarili: onay,
      durum: onay ? 'ONAYLANDI' : 'BASARISIZ',
      islemNo,
      saglayici: this.saglayici(),
      hata,
    };
  }

  private logEkle(kayit: MockPaytrLogKaydi) {
    MockPaytrAdapter.log.unshift(kayit);
    if (MockPaytrAdapter.log.length > MockPaytrAdapter.maxLog) {
      MockPaytrAdapter.log.length = MockPaytrAdapter.maxLog;
    }
  }
}
