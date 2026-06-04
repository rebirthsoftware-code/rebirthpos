/**
 * Müşteri ekranı senkronizasyon kanalı.
 *
 * Kasa ekranı (POS) → ayrı bir pencere/monitorde açılan müşteri ekranı,
 * aynı origin'de localStorage event'i üzerinden senkronize olur.
 *
 * - `aktifAdisyonYaz(id)`: kasada bir adisyon açılınca çağrılır.
 * - `aktifAdisyonTemizle()`: adisyon kapanınca veya hızlı satış bitince.
 * - `odemeDurumuYaz({...})`: ödeme ekranı açıkken anlık tutar/para üstü.
 * - `odemeDurumuTemizle()`: ödeme ekranı kapanınca.
 * - `tesekkurGoster()`: tahsilat sonrası 5 sn teşekkür ekranı.
 *
 * Müşteri ekranı bu key'leri dinleyip görüntülenecek içeriği yeniden çizer.
 */

const KEY_ADISYON = 'rebirth-musteri-adisyon';
const KEY_ODEME = 'rebirth-musteri-odeme';
const KEY_SEPET = 'rebirth-musteri-sepet';
const KEY_TESEKKUR = 'rebirth-musteri-tesekkur';
const KEY_KART = 'rebirth-musteri-kart';
const KEY_PING = 'rebirth-musteri-ping';

export interface MusteriOdemeDurumu {
  toplam: number;
  alinan: number;
  paraUstu: number;
  tip?: string;
  mod?: string;
  // Adisyon bağlamı — müşteri ekranı masa adı + adisyon no gösterir
  masaAd?: string | null;
  adisyonNo?: string;
}

export interface MusteriSepetKalemi {
  ad: string;
  adet: number;
  birimFiyat: number;
  toplam: number;
}

export interface MusteriSepetVerisi {
  kalemler: MusteriSepetKalemi[];
  toplam: number;
}

export interface MusteriKartIslemi {
  durum: 'cekiliyor' | 'basarili' | 'red';
  tutar: number;
  slipNo?: string;
  banka?: string;
  sonRakam?: string;
  hata?: string;
}

function setItem(key: string, value: string | null) {
  if (!import.meta.client) return;
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {}
}

function getItem(key: string): string | null {
  if (!import.meta.client) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function useMusteriEkran() {
  function aktifAdisyonYaz(id: string) {
    setItem(KEY_ADISYON, id);
  }
  function aktifAdisyonTemizle() {
    setItem(KEY_ADISYON, null);
  }
  function aktifAdisyonOku(): string | null {
    return getItem(KEY_ADISYON);
  }

  function odemeDurumuYaz(durum: MusteriOdemeDurumu) {
    setItem(KEY_ODEME, JSON.stringify(durum));
  }
  function odemeDurumuTemizle() {
    setItem(KEY_ODEME, null);
  }
  function odemeDurumuOku(): MusteriOdemeDurumu | null {
    const v = getItem(KEY_ODEME);
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  }

  function sepetYaz(sepet: MusteriSepetVerisi) {
    setItem(KEY_SEPET, JSON.stringify(sepet));
  }
  function sepetTemizle() {
    setItem(KEY_SEPET, null);
  }
  function sepetOku(): MusteriSepetVerisi | null {
    const v = getItem(KEY_SEPET);
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  }

  function kartIslemiYaz(islem: MusteriKartIslemi) {
    setItem(KEY_KART, JSON.stringify(islem));
  }
  function kartIslemiTemizle() {
    setItem(KEY_KART, null);
  }
  function kartIslemiOku(): MusteriKartIslemi | null {
    const v = getItem(KEY_KART);
    if (!v) return null;
    try { return JSON.parse(v); } catch { return null; }
  }

  function tesekkurGoster(saniye = 5) {
    const bitis = Date.now() + saniye * 1000;
    setItem(KEY_TESEKKUR, String(bitis));
  }
  function tesekkurOku(): number | null {
    const v = getItem(KEY_TESEKKUR);
    if (!v) return null;
    const bitis = Number(v);
    if (!Number.isFinite(bitis) || bitis < Date.now()) {
      setItem(KEY_TESEKKUR, null);
      return null;
    }
    return bitis;
  }
  function tesekkurTemizle() {
    setItem(KEY_TESEKKUR, null);
  }

  function ping() {
    setItem(KEY_PING, String(Date.now()));
  }

  /**
   * Müşteri ekranı sayfası, değişiklikleri dinlemek için bu metodu çağırır.
   * Dönen `temizle` fonksiyonu component unmount'ta çağrılmalı.
   */
  function dinle(callback: () => void): () => void {
    if (!import.meta.client) return () => {};
    const handler = (e: StorageEvent) => {
      if (!e.key) return;
      if ([KEY_ADISYON, KEY_ODEME, KEY_SEPET, KEY_TESEKKUR, KEY_KART].includes(e.key)) {
        callback();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }

  /**
   * Müşteri ekranı yeni mount edildiğinde önceki oturumdan kalan tüm
   * stale verileri sıfırlar. localStorage hayatta kalıyor olabilir.
   */
  function hepsiniTemizle() {
    setItem(KEY_ADISYON, null);
    setItem(KEY_ODEME, null);
    setItem(KEY_SEPET, null);
    setItem(KEY_TESEKKUR, null);
    setItem(KEY_KART, null);
  }

  /**
   * Cross-window iletişim: müşteri ekranı açıldığında kasa penceresinden
   * mevcut state'i tekrar yayınlamasını ister. BroadcastChannel kullanır —
   * storage event'i kendi tab'ında çalışmadığı için bu daha güvenilir.
   */
  function durumYenilemeTetikle() {
    if (!import.meta.client || typeof BroadcastChannel === 'undefined') return;
    try {
      const ch = new BroadcastChannel('rebirth-musteri-sync');
      ch.postMessage({ tip: 'yenile-iste' });
      ch.close();
    } catch {}
  }

  /**
   * Kasa pencereleri bu metotla "yenileme iste" mesajını dinler.
   * AppOdemeEkrani / hizli.vue açıkken bu çağrı state'i tekrar yazar.
   */
  function yenilemeIsteklerineCevapla(yazicıCallback: () => void): () => void {
    if (!import.meta.client || typeof BroadcastChannel === 'undefined') return () => {};
    try {
      const ch = new BroadcastChannel('rebirth-musteri-sync');
      ch.onmessage = (e: MessageEvent) => {
        if (e.data?.tip === 'yenile-iste') yazicıCallback();
      };
      return () => ch.close();
    } catch {
      return () => {};
    }
  }

  return {
    aktifAdisyonYaz,
    aktifAdisyonTemizle,
    aktifAdisyonOku,
    odemeDurumuYaz,
    odemeDurumuTemizle,
    odemeDurumuOku,
    sepetYaz,
    sepetTemizle,
    sepetOku,
    kartIslemiYaz,
    kartIslemiTemizle,
    kartIslemiOku,
    tesekkurGoster,
    tesekkurOku,
    tesekkurTemizle,
    ping,
    dinle,
    hepsiniTemizle,
    durumYenilemeTetikle,
    yenilemeIsteklerineCevapla,
  };
}
