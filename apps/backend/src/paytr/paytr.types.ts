// PayTR Sanal POS (online ödeme) adapter sözleşmesi.
// QR menüden müşteri masadaki hesabını kartıyla online öder.
//
// Gerçek PayTR akışı (iframe API):
//   1) Backend merchant_id + sepet + tutar + hash → PayTR'den bir TOKEN alır
//   2) Frontend https://www.paytr.com/odeme/guvenli/{token} iframe'ini açar
//   3) Müşteri kartıyla 3D-secure öder
//   4) PayTR sunucudan sunucuya callback POST atar (hash doğrulanır) → ödeme onaylanır
//
// Mock adapter aynı arayüzü uygular ama gerçek PayTR'ye gitmez: token üretir,
// sonucu test moduna göre ONAYLANDI/BASARISIZ döner. Böylece entegre bilgileri
// (merchant_id, merchant_key, merchant_salt) gelince yalnız yeni bir adapter
// eklenir; QrService/akış değişmez.

export interface PaytrSepetKalem {
  ad: string;
  adet: number;
  // KDV dahil birim fiyat (TL)
  birimFiyat: number;
}

export interface PaytrOdemeBaslatIstegi {
  // Tahsil edilecek tutar (TL)
  tutar: number;
  // Hangi adisyon/ödeme için — fiş/eşleştirme referansı
  adisyonId: string;
  subeId: string;
  // Müşteri bilgileri (PayTR zorunlu alanları)
  musteriAd?: string;
  musteriEposta?: string;
  musteriTel?: string;
  musteriIp?: string;
  // PayTR sepet alanı için
  sepet?: PaytrSepetKalem[];
  // Banka ekranında / fişte görünecek sipariş no
  siparisNo: string;
}

export interface PaytrOdemeBaslatYaniti {
  basarili: boolean;
  // Ödeme oturum token'ı — frontend bunu güvenli ödeme sayfasına taşır
  token?: string;
  // Müşterinin yönlendirileceği güvenli ödeme sayfası.
  // MOCK için boş döner → frontend kendi test ödeme sayfasını açar.
  // Gerçek PayTR için: https://www.paytr.com/odeme/guvenli/{token}
  odemeUrl?: string;
  // Hangi sağlayıcı işliyor (MOCK | PAYTR)
  saglayici: string;
  // MOCK ise test modu bilgisi (frontend rozet gösterir)
  testMod?: string;
  hata?: string;
  ham?: unknown;
}

export interface PaytrSonucIstegi {
  // odemeBaslat'tan dönen token
  token: string;
  // Müşterinin sonucu — gerçek PayTR'de bu PayTR callback'inden gelir,
  // MOCK'ta test ödeme sayfasındaki "Öde / Başarısız" butonundan gelir.
  basariliMi?: boolean;
  // Gerçek PayTR callback hash doğrulaması için ham gövde
  ham?: Record<string, unknown>;
}

export interface PaytrSonucYaniti {
  basarili: boolean;
  durum: 'ONAYLANDI' | 'BASARISIZ';
  // Banka/PayTR işlem referansı — fiş ve denetim için
  islemNo?: string;
  saglayici: string;
  hata?: string;
  ham?: unknown;
}

export interface IPaytrAdapter {
  saglayici(): string;
  durum(): Promise<{ hazir: boolean; aciklama: string }>;
  odemeBaslat(istek: PaytrOdemeBaslatIstegi): Promise<PaytrOdemeBaslatYaniti>;
  sonucDogrula(istek: PaytrSonucIstegi): Promise<PaytrSonucYaniti>;
}
