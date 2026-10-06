'use client';
// Tarayıcı tarafı: fotoğrafı küçült (EXIF/GPS silinir), video kapağı çıkar, dosyaları yükle
import { upload } from '@vercel/blob/client';
import type { MedyaTuru, YuklenenMedya } from '@/lib/tipler';

export type Depolama = 'blob' | 'yerel';

const rastgele = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function canvasBlob(c: HTMLCanvasElement, kalite: number): Promise<Blob> {
  return new Promise((coz, red) => c.toBlob((b) => (b ? coz(b) : red(new Error('Görsel oluşturulamadı'))), 'image/jpeg', kalite));
}

function ciz(kaynak: CanvasImageSource, w: number, h: number, maks: number): HTMLCanvasElement {
  const oran = Math.min(1, maks / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * oran));
  c.height = Math.max(1, Math.round(h * oran));
  const x = c.getContext('2d')!;
  x.fillStyle = '#fff'; // PNG şeffaflığı beyaz zemine
  x.fillRect(0, 0, c.width, c.height);
  x.imageSmoothingQuality = 'high';
  x.drawImage(kaynak, 0, 0, c.width, c.height);
  return c;
}

export interface HazirFoto { ana: Blob; kucuk: Blob; g: number; y: number; mime: string }

/** Fotoğrafı yeniden kodlar: en uzun kenar 2000px + 640px önizleme. Yeniden kodlama tüm EXIF'i (konum dahil) siler. */
export async function fotoHazirla(dosya: File): Promise<HazirFoto> {
  if (dosya.type === 'image/gif') {
    // Hareketli GIF bozulmasın: olduğu gibi gönder
    return { ana: dosya, kucuk: dosya, g: 0, y: 0, mime: 'image/gif' };
  }
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(dosya, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${dosya.name}" açılamadı. JPEG veya PNG biçiminde bir fotoğraf seç.`);
  }
  const ana = ciz(bmp, bmp.width, bmp.height, 2000);
  const kucuk = ciz(bmp, bmp.width, bmp.height, 640);
  bmp.close();
  return { ana: await canvasBlob(ana, 0.86), kucuk: await canvasBlob(kucuk, 0.8), g: ana.width, y: ana.height, mime: 'image/jpeg' };
}

export interface VideoBilgi { kapak: Blob | null; g: number; y: number; sure: number }

/** Videonun ilk saniyelerinden kapak karesi alır (duvarda ve TV'de hızlı önizleme için) */
export function videoKapak(dosya: File): Promise<VideoBilgi> {
  return new Promise((coz) => {
    const url = URL.createObjectURL(dosya);
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.src = url;
    let bitti = false;
    const son = (b: VideoBilgi) => { if (bitti) return; bitti = true; URL.revokeObjectURL(url); coz(b); };
    const zamanAsimi = setTimeout(() => son({ kapak: null, g: v.videoWidth, y: v.videoHeight, sure: v.duration || 0 }), 8000);
    v.onloadedmetadata = () => { v.currentTime = Math.min(0.6, (v.duration || 1) / 3); };
    v.onseeked = async () => {
      clearTimeout(zamanAsimi);
      try {
        const c = ciz(v, v.videoWidth, v.videoHeight, 900);
        son({ kapak: await canvasBlob(c, 0.8), g: v.videoWidth, y: v.videoHeight, sure: v.duration || 0 });
      } catch {
        son({ kapak: null, g: v.videoWidth, y: v.videoHeight, sure: v.duration || 0 });
      }
    };
    v.onerror = () => { clearTimeout(zamanAsimi); son({ kapak: null, g: 0, y: 0, sure: 0 }); };
  });
}

const UZANTI: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v',
  'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/aac': 'aac',
};

/** "video/quicktime" gibi sade tür (codecs vb. parametreler atılır); iOS'ta boş gelen .mov türünü tamamlar */
export function sadeMime(f: Blob & { name?: string }, tur: MedyaTuru): string {
  const t = (f.type || '').split(';')[0].trim().toLowerCase();
  if (t) return t;
  const ad = (f.name || '').toLowerCase();
  if (tur === 'video') return ad.endsWith('.mov') || ad.endsWith('.qt') ? 'video/quicktime' : 'video/mp4';
  return tur === 'ses' ? 'audio/webm' : 'image/jpeg';
}

/** Tek dosyayı seçili depoya yükler, URL döndürür */
export async function dosyaGonder(
  veri: Blob, tur: MedyaTuru, mime: string, depolama: Depolama,
  ilerleme: (yuklenen: number) => void, iptal: AbortSignal,
): Promise<string> {
  if (depolama === 'blob') {
    const sonuc = await upload(`anilar/${tur}/${rastgele()}.${UZANTI[mime] ?? 'bin'}`, veri, {
      access: 'public',
      handleUploadUrl: '/api/yukleme',
      clientPayload: JSON.stringify({ tur }),
      contentType: mime,
      multipart: veri.size > 20 * 1024 * 1024,
      abortSignal: iptal,
      onUploadProgress: (e) => ilerleme(e.loaded),
    });
    return sonuc.url;
  }
  return new Promise((coz, red) => {
    const x = new XMLHttpRequest();
    x.open('POST', `/api/yukleme?tur=${tur}`);
    x.setRequestHeader('Content-Type', mime);
    x.upload.onprogress = (e) => ilerleme(e.loaded);
    x.onload = () => {
      let j: { url?: string; hata?: string } = {};
      try { j = JSON.parse(x.responseText); } catch { /* */ }
      if (x.status === 200 && j.url) coz(j.url);
      else red(new Error(j.hata || (x.status === 413 ? 'Dosya çok büyük' : 'Yükleme başarısız oldu')));
    };
    x.onerror = () => red(new Error('Bağlantı koptu. İnternetini kontrol edip tekrar dene.'));
    x.onabort = () => red(new DOMException('İptal edildi', 'AbortError'));
    iptal.addEventListener('abort', () => x.abort(), { once: true });
    x.send(veri);
  });
}

export type { YuklenenMedya };
