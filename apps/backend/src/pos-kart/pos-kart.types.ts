// POS kart cihazı (Ingenico/PAVO/Verifone) adapter sözleşmesi.
// Mock ve gerçek implementasyonlar bu interface üzerinden konuşur.
// Backend PosKartService adapter'a bağımlı kalır, hangi marka olduğunu bilmez.

export interface PosKartCekIstegi {
  tutar: number;
  // Müşteri ekranı ya da fiş için referans (opsiyonel)
  referans?: string;
}

export interface PosKartCekYaniti {
  basarili: boolean;
  // Banka onay (slip) numarası — fiş üstünde basılı çıkar
  slipNo?: string;
  // Reference Retrieval Number — banka takip numarası
  rrn?: string;
  // Banka adı (örn. "Garanti", "İş Bankası")
  banka?: string;
  // Kart numarasının son 4 hanesi — fiş üstünde maskeli
  sonRakam?: string;
  // Banka onay kodu
  onayKod?: string;
  // Hangi terminal işledi
  terminalMarka?: string;
  // Hata olduysa neden
  hata?: string;
  // Adapter-spesifik orijinal yanıt (debug)
  ham?: unknown;
}

export interface PosKartIadeIstegi {
  // Orijinal işlemin slipNo veya rrn'si
  orijinalSlipNo: string;
  tutar: number;
}

export interface IPosKartAdapter {
  marka(): string;
  durum(): Promise<{ cihazBagli: boolean; aciklama: string }>;
  cek(istek: PosKartCekIstegi): Promise<PosKartCekYaniti>;
  iade(istek: PosKartIadeIstegi): Promise<PosKartCekYaniti>;
}
