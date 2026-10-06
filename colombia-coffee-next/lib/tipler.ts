export type MedyaTuru = 'foto' | 'video' | 'ses';
export type AniDurumu = 'yayinda' | 'bekliyor' | 'gizli';

export interface Medya {
  tur: MedyaTuru;
  url: string;
  onizleme: string; // foto: küçük görsel, video: kapak karesi, ses: ''
  mime: string;
  g: number;
  y: number;
  sure: number; // saniye (video/ses)
}

export interface Ani {
  id: number;
  isim: string;
  not: string;
  durum: AniDurumu;
  tarih: string; // ISO
  medya: Medya[];
  tepkiler: Record<string, number>;
  benim: string[]; // bu cihazın verdiği tepkiler
}

/** İstemcinin yükleme sonrası gönderdiği medya bilgisi */
export interface YuklenenMedya {
  tur: MedyaTuru;
  url: string;
  onizleme?: string;
  mime: string;
  g?: number;
  y?: number;
  sure?: number;
}
