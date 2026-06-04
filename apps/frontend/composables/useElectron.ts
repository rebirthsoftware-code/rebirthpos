/**
 * Electron native köprüsü.
 * Tarayıcıda çalışırken `mevcut: false` döner — kod web ile uyumlu kalır.
 */

interface YaziciOzet {
  ad: string;
  gorunenAd: string;
  durum: string;
  varsayilan: boolean;
}

interface UygulamaBilgi {
  versiyon: string;
  platform: string;
  electron: string;
  chrome: string;
  node: string;
}

interface RebirthBridge {
  ayar: {
    al: (anahtar: string) => Promise<any>;
    kaydet: (anahtar: string, deger: any) => Promise<boolean>;
  };
  uygulama: { bilgi: () => Promise<UygulamaBilgi> };
  pencere: {
    tamEkran: () => Promise<boolean>;
    kucuk: () => Promise<void>;
    kapat: () => Promise<void>;
  };
  yazici: {
    liste: () => Promise<YaziciOzet[]>;
    yazdir: (
      icerik: string,
      ayarlar?: { yaziciAdi?: string; kagit?: string; kopya?: number },
    ) => Promise<{ ok: boolean; hata?: string }>;
    testFis: (yaziciAdi?: string) => Promise<{ ok: boolean; hata?: string }>;
  };
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    rebirth?: RebirthBridge;
  }
}

export function useElectron() {
  const mevcut = computed(() => {
    if (!import.meta.client) return false;
    return !!window.rebirth?.isElectron;
  });

  const bridge = computed(() => (import.meta.client ? window.rebirth : undefined));

  return {
    mevcut,
    /** Electron'da mıyız? */
    isElectron: mevcut,

    ayar: {
      async al<T = any>(anahtar: string, varsayilan?: T): Promise<T | undefined> {
        if (!bridge.value) return varsayilan;
        const v = await bridge.value.ayar.al(anahtar);
        return v ?? varsayilan;
      },
      async kaydet(anahtar: string, deger: any) {
        if (!bridge.value) return false;
        return bridge.value.ayar.kaydet(anahtar, deger);
      },
    },

    pencere: {
      tamEkran: () => bridge.value?.pencere.tamEkran(),
      kucuk: () => bridge.value?.pencere.kucuk(),
      kapat: () => bridge.value?.pencere.kapat(),
    },

    yazici: {
      async liste(): Promise<YaziciOzet[]> {
        if (!bridge.value) return [];
        return bridge.value.yazici.liste();
      },
      async yazdir(html: string, opts?: { yaziciAdi?: string; kagit?: string; kopya?: number }) {
        if (!bridge.value) {
          // Tarayıcı fallback — yazdırma diyaloğu aç
          if (import.meta.client) window.print();
          return { ok: true };
        }
        return bridge.value.yazici.yazdir(html, opts);
      },
      async test(yaziciAdi?: string) {
        if (!bridge.value) return { ok: false, hata: 'Sadece masaüstü uygulamada' };
        return bridge.value.yazici.testFis(yaziciAdi);
      },
    },

    async uygulamaBilgi(): Promise<UygulamaBilgi | null> {
      if (!bridge.value) return null;
      return bridge.value.uygulama.bilgi();
    },
  };
}
