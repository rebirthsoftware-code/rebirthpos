// Ortam değişkenlerinden okunan mekan ve sistem ayarları
export const MEKAN = {
  ad: process.env.MEKAN_ADI || 'Colombia Coffee',
  slogan: process.env.MEKAN_SLOGAN || 'Her fincanın bir hikâyesi var',
  konum: process.env.MEKAN_KONUM || '',
  instagram: (process.env.MEKAN_INSTAGRAM || '').replace(/^@/, ''),
};

export const SINIR = {
  fotoMb: 25, // istemcide küçültülmeden önceki ham fotoğraf
  videoMb: 250,
  sesMb: 25,
  dosya: 10,
  not: 500,
  isim: 60,
  saatlik: 20, // cihaz başına saatlik gönderi
};

export const TEPKILER = ['☕', '🌿', '❤️', '😍'] as const;
export type Tepki = (typeof TEPKILER)[number];

export const depolamaTuru = (): 'blob' | 'yerel' => (process.env.BLOB_READ_WRITE_TOKEN ? 'blob' : 'yerel');
