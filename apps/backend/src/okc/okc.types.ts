// ÖKC adapter sözleşmesi. Mock ve gerçek (Beko/Ingenico) implementasyonlar
// bu interface üzerinden konuşur. Backend OkcService adapter'a bağımlı kalır,
// hangi marka ise diye bilmez — gerçek SDK gelince adapter swap yeter.

export interface OkcKalem {
  ad: string;
  adet: number;
  birimFiyat: number;
  toplam: number;
  kdvOrani: number;
}

export interface OkcOdeme {
  tip: 'NAKIT' | 'KREDI_KARTI' | 'YEMEKSEPETI' | 'TICKET';
  tutar: number;
}

export interface OkcKdvSatiri {
  oran: number;
  matrah: number;
  kdv: number;
}

export interface OkcFisIstegi {
  adisyonNo: string;
  kalemler: OkcKalem[];
  odemeler: OkcOdeme[];
  kdvDokumu: OkcKdvSatiri[];
  araToplam: number;
  iskontoTutar: number;
  toplamTutar: number;
}

export interface OkcFisYaniti {
  basarili: boolean;
  fisNo?: string;
  fisTarihi?: Date;
  marka?: string;
  hata?: string;
  ham?: unknown; // adapter-spesifik orijinal yanıt (debug için)
}

// ── GİB Raporları (Z = mali kapanış, X = ara) ──

export interface OkcRaporKdvSatiri {
  oran: number;
  matrah: number;
  kdv: number;
}

export interface OkcRaporOdemeBolumu {
  tip: string;
  tutar: number;
  fisSayisi: number;
}

export interface OkcXRaporu {
  raporTipi: 'X';
  marka: string;
  uretildiTarih: Date;
  baslama: Date | null;
  bitis: Date;
  fisSayisi: number;
  hataliFisSayisi: number;
  toplamSatis: number;
  araToplam: number;
  toplamKdv: number;
  toplamIskonto: number;
  toplamIade: number;
  kdvBantlari: OkcRaporKdvSatiri[];
  odemeler: OkcRaporOdemeBolumu[];
  ham?: unknown;
}

export interface OkcZRaporu extends Omit<OkcXRaporu, 'raporTipi'> {
  raporTipi: 'Z';
  // Mali kapanış numarası — her Z'de monotonik artar
  zNo: number;
}

export interface OkcIadeIstegi {
  orijinalFisNo: string;
  tutar: number;
  aciklama?: string;
}

export interface OkcIadeYaniti {
  basarili: boolean;
  iadeFisNo?: string;
  tarih?: Date;
  marka?: string;
  hata?: string;
}

export interface IOkcAdapter {
  marka(): string;
  satisKaydet(istek: OkcFisIstegi): Promise<OkcFisYaniti>;
  durum(): Promise<{ cihazBagli: boolean; aciklama: string }>;
  // GİB raporları
  xRaporu(): Promise<OkcXRaporu>;
  zRaporu(): Promise<OkcZRaporu>;
  iade(istek: OkcIadeIstegi): Promise<OkcIadeYaniti>;
}
