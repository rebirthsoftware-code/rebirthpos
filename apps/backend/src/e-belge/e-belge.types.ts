// e-Belge (e-Arşiv, e-Fatura, e-SMM) adapter sözleşmesi.
// 593 No.lu VUK Tebliği gereği ÖKC entegre yazılımı e-Belge düzenleyebilir.
//
// Mock ve gerçek entegratör (Logo, EFinans, Foriba, Uyumsoft) bu interface
// üzerinden konuşur — backend EBelgeService adapter'a bağımlı kalır.

export type EBelgeTip = 'E_ARSIV' | 'E_FATURA' | 'E_SMM';
export type EBelgeDurum = 'TASLAK' | 'GONDERILDI' | 'ONAYLANDI' | 'REDDEDILDI' | 'IPTAL';

export interface EBelgeKalem {
  ad: string;
  adet: number;
  birimFiyat: number;
  kdvOrani: number;
  toplam: number; // KDV dahil
}

export interface EBelgeKdvSatiri {
  oran: number;
  matrah: number;
  kdv: number;
}

export interface EBelgeOdeme {
  tip: string; // NAKIT | KREDI_KARTI | HAVALE | ...
  tutar: number;
}

export interface EBelgeAlici {
  ad: string;
  vergiNo?: string;       // VKN(10) tüzel veya TCKN(11) bireysel
  vergiDairesi?: string;
  adres?: string;
  eposta?: string;
  telefon?: string;
}

export interface EBelgeDuzenleIstek {
  tip: EBelgeTip;
  alici: EBelgeAlici;
  kalemler: EBelgeKalem[];
  odemeler: EBelgeOdeme[];
  araToplam: number;
  iskontoTutar: number;
  kdvTutar: number;
  toplamTutar: number;
  kdvDokumu: EBelgeKdvSatiri[];
  // Belge üstüne yazılacak serbest not (örn. "Adisyon No: A-2026...")
  not?: string;
  // İstemci tarafı tetkik için referans (idempotency yok ama trace için)
  referans?: string;
}

export interface EBelgeDuzenleYanit {
  basarili: boolean;
  // Sistemin ürettiği belge numarası (örn. ER2026000000001)
  belgeNo?: string;
  // Evrensel Tekil Tanımlama Numarası (32 hex char, GİB standardı)
  ettn?: string;
  marka?: string;
  // Belge PDF veya HTML preview url (entegratör verirse)
  pdfUrl?: string;
  // Belge GİB'e iletildi mi
  gonderildi?: boolean;
  duzenlenmeTarihi?: Date;
  hata?: string;
  // Entegratör ham yanıtı (debug)
  ham?: unknown;
}

export interface EBelgeIadeYanit {
  basarili: boolean;
  iadeBelgeNo?: string;
  iadeEttn?: string;
  hata?: string;
}

export interface IEBelgeAdapter {
  marka(): string; // MOCK | LOGO | EFINANS | UYUMSOFT | FORIBA
  durum(): Promise<{ baglandi: boolean; aciklama: string }>;
  /** e-Arşiv / e-Fatura / e-SMM düzenle ve GİB'e gönder. */
  faturaDuzenle(istek: EBelgeDuzenleIstek): Promise<EBelgeDuzenleYanit>;
  /** Düzenlenmiş bir belgeyi iade et — orijinal belgenin ETTN'i ile. */
  iade(orijinalEttn: string, tutar: number, sebep?: string): Promise<EBelgeIadeYanit>;
}
