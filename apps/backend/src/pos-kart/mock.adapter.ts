import { Injectable } from '@nestjs/common';
import {
  IPosKartAdapter,
  PosKartCekIstegi,
  PosKartCekYaniti,
  PosKartIadeIstegi,
} from './pos-kart.types';

export type MockKartTestMod = 'AUTO' | 'BASARI' | 'HATA';

export interface MockKartLogKaydi {
  zaman: string;
  islem: 'CEK' | 'IADE';
  basarili: boolean;
  tutar: number;
  slipNo?: string;
  rrn?: string;
  banka?: string;
  sonRakam?: string;
  onayKod?: string;
  referans?: string;
  // İşlem süresi (ms) — performans metrikleri
  sureMs: number;
  hata?: string;
}

const BANKALAR = ['Garanti BBVA', 'İş Bankası', 'Akbank', 'Yapı Kredi', 'Ziraat', 'Halkbank'];

function rastgele<T>(liste: T[]): T {
  return liste[Math.floor(Math.random() * liste.length)];
}
function altiHaneliKod(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function rrnUret(): string {
  return String(Math.floor(100000000000 + Math.random() * 900000000000));
}
function sonRakamUret(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Geliştirme + test için kart POS mock'u. Cihaz-test sayfasından
 * kontrol edilebilir:
 *   - testMod: AUTO (rastgele %97 onay) | BASARI (her zaman onay) | HATA (her zaman red)
 *   - gecikmeMs: simülasyon gecikmesi (gerçek terminalde ~1-2 sn)
 *   - log: son N işlem
 */
@Injectable()
export class MockPosKartAdapter implements IPosKartAdapter {
  private fisSayac = 0;

  // Test simulator state — process içinde
  static testMod: MockKartTestMod = 'AUTO';
  static gecikmeMs = 1200;
  static log: MockKartLogKaydi[] = [];
  static readonly maxLog = 50;

  marka(): string {
    return 'MOCK';
  }

  async durum(): Promise<{ cihazBagli: boolean; aciklama: string }> {
    return {
      cihazBagli: MockPosKartAdapter.testMod !== 'HATA',
      aciklama: `Mock POS kart · test mod: ${MockPosKartAdapter.testMod} · gecikme: ${MockPosKartAdapter.gecikmeMs}ms`,
    };
  }

  async cek(istek: PosKartCekIstegi): Promise<PosKartCekYaniti> {
    const baslangic = Date.now();
    await new Promise((r) => setTimeout(r, MockPosKartAdapter.gecikmeMs));
    const zaman = new Date().toISOString();
    const ortakLog = { zaman, islem: 'CEK' as const, tutar: istek.tutar || 0, referans: istek.referans };

    if (!Number.isFinite(istek.tutar) || istek.tutar <= 0) {
      const hata = 'Geçersiz tutar';
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, hata };
    }

    // Test mod yönlendirmesi
    let red = false;
    let hataMesaj = '';
    if (MockPosKartAdapter.testMod === 'HATA') {
      red = true;
      hataMesaj = 'TEST: Kart cihazı zorlamalı red modunda';
    } else if (MockPosKartAdapter.testMod === 'AUTO' && Math.random() < 0.03) {
      red = true;
      hataMesaj = 'İşlem reddedildi (yetersiz bakiye)';
    }

    if (red) {
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata: hataMesaj });
      return { basarili: false, hata: hataMesaj, terminalMarka: this.marka() };
    }

    this.fisSayac++;
    const slipNo = `MOCK-${String(this.fisSayac).padStart(6, '0')}`;
    const yanit: PosKartCekYaniti = {
      basarili: true,
      slipNo,
      rrn: rrnUret(),
      banka: rastgele(BANKALAR),
      sonRakam: sonRakamUret(),
      onayKod: altiHaneliKod(),
      terminalMarka: this.marka(),
    };
    this.logEkle({
      ...ortakLog,
      basarili: true,
      sureMs: Date.now() - baslangic,
      slipNo: yanit.slipNo,
      rrn: yanit.rrn,
      banka: yanit.banka,
      sonRakam: yanit.sonRakam,
      onayKod: yanit.onayKod,
    });
    return yanit;
  }

  async iade(istek: PosKartIadeIstegi): Promise<PosKartCekYaniti> {
    const baslangic = Date.now();
    await new Promise((r) => setTimeout(r, Math.min(MockPosKartAdapter.gecikmeMs, 800)));
    const zaman = new Date().toISOString();
    const ortakLog = { zaman, islem: 'IADE' as const, tutar: istek.tutar };

    if (MockPosKartAdapter.testMod === 'HATA') {
      const hata = 'TEST: İade zorlamalı red modunda';
      this.logEkle({ ...ortakLog, basarili: false, sureMs: Date.now() - baslangic, hata });
      return { basarili: false, hata, terminalMarka: this.marka() };
    }

    const yanit: PosKartCekYaniti = {
      basarili: true,
      slipNo: `MOCK-IADE-${altiHaneliKod()}`,
      rrn: rrnUret(),
      onayKod: altiHaneliKod(),
      terminalMarka: this.marka(),
    };
    this.logEkle({ ...ortakLog, basarili: true, sureMs: Date.now() - baslangic, slipNo: yanit.slipNo, rrn: yanit.rrn, onayKod: yanit.onayKod });
    return yanit;
  }

  private logEkle(kayit: MockKartLogKaydi) {
    MockPosKartAdapter.log.unshift(kayit);
    if (MockPosKartAdapter.log.length > MockPosKartAdapter.maxLog) {
      MockPosKartAdapter.log.length = MockPosKartAdapter.maxLog;
    }
  }
}
