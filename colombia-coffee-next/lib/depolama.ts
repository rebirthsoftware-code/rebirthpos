import 'server-only';
import { mkdir, open, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { MedyaTuru } from './tipler';
import { SINIR, depolamaTuru } from './ayarlar';

export const YUKLEME_KLASORU = path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.YUKLEME_KLASORU || 'yuklemeler');

/** İzin verilen içerik türleri (tür → mime → uzantı) */
export const IZINLI: Record<MedyaTuru, Record<string, string>> = {
  foto: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' },
  video: { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/3gpp': '3gp', 'video/x-m4v': 'm4v' },
  ses: { 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/aac': 'aac', 'video/webm': 'webm' },
};

export const MAKS_BAYT: Record<MedyaTuru, number> = {
  foto: SINIR.fotoMb * 1024 * 1024,
  video: SINIR.videoMb * 1024 * 1024,
  ses: SINIR.sesMb * 1024 * 1024,
};

/** Dosyanın ilk baytlarından gerçek türünü bulur (uzantıya / tarayıcının söylediğine güvenmeyiz) */
export function icerikTuru(b: Uint8Array): string | null {
  const ascii = (bas: number, son: number) => String.fromCharCode(...b.subarray(bas, son));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x89 && ascii(1, 4) === 'PNG') return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'audio/wav';
  if (ascii(0, 3) === 'GIF') return 'image/gif';
  if (ascii(0, 4) === 'OggS') return 'audio/ogg';
  if (ascii(0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return 'audio/mpeg';
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'; // Matroska/WebM (ses ya da video)
  if (ascii(4, 8) === 'ftyp') {
    const marka = ascii(8, 12);
    if (marka === 'qt  ') return 'video/quicktime';
    if (marka.startsWith('M4A')) return 'audio/mp4';
    if (marka.startsWith('3g')) return 'video/3gpp';
    if (marka === 'M4V ' || marka === 'M4VH') return 'video/x-m4v';
    return 'video/mp4';
  }
  return null;
}

/** Tür eşleşmesi: WebM / MP4 kapsayıcısı hem ses hem video olabilir */
export function turUygun(tur: MedyaTuru, mime: string): string | null {
  if (IZINLI[tur][mime]) return mime;
  if (tur === 'ses' && mime === 'video/mp4') return 'audio/mp4';
  if (tur === 'ses' && mime === 'video/webm') return 'audio/webm';
  return null;
}

/** Yerel depolama: istek gövdesini akış hâlinde diske yazar, boyut ve tür kontrolü yapar */
export async function yereleKaydet(govde: ReadableStream<Uint8Array>, tur: MedyaTuru): Promise<{ url: string; mime: string }> {
  const ay = new Date().toISOString().slice(0, 7).replace('-', '/');
  const klasor = path.join(/*turbopackIgnore: true*/ YUKLEME_KLASORU, ay);
  await mkdir(klasor, { recursive: true });
  const ad = randomBytes(12).toString('hex');
  const gecici = path.join(/*turbopackIgnore: true*/ klasor, `${ad}.yukleniyor`);
  const dosya = await open(gecici, 'w');
  let toplam = 0;
  let mime: string | null = null;
  try {
    const okuyucu = govde.getReader();
    for (;;) {
      const { done, value } = await okuyucu.read();
      if (done) break;
      if (mime === null) {
        mime = turUygun(tur, icerikTuru(value) ?? '');
        if (!mime) throw new Error('Desteklenmeyen dosya türü');
      }
      toplam += value.length;
      if (toplam > MAKS_BAYT[tur]) throw new Error('Dosya çok büyük');
      await dosya.write(value);
    }
    if (!mime || toplam === 0) throw new Error('Dosya boş');
  } catch (e) {
    await dosya.close();
    await rm(gecici, { force: true });
    throw e;
  }
  await dosya.close();
  const son = path.join(/*turbopackIgnore: true*/ klasor, `${ad}.${IZINLI[tur][mime] ?? 'bin'}`);
  await rename(gecici, son);
  return { url: `/medya/${ay}/${path.basename(son)}`, mime };
}

/** /medya/... yolunu güvenli dosya yoluna çevirir (klasör dışına çıkışı engeller) */
export function yerelYol(parcalar: string[]): string | null {
  const yol = path.resolve(/*turbopackIgnore: true*/ YUKLEME_KLASORU, ...parcalar);
  return yol.startsWith(YUKLEME_KLASORU + path.sep) ? yol : null;
}

export async function dosyaVarMi(url: string): Promise<boolean> {
  if (!url.startsWith('/medya/')) return false;
  const yol = yerelYol(url.slice('/medya/'.length).split('/'));
  if (!yol) return false;
  try { return (await stat(yol)).isFile(); } catch { return false; }
}

/** Gönderilen URL'nin gerçekten bizim depomuza ait olduğunu doğrular */
export async function urlBizimMi(url: string): Promise<boolean> {
  if (!url) return false;
  if (depolamaTuru() === 'yerel') return dosyaVarMi(url);
  try {
    const u = new URL(url);
    // Token'ın içindeki mağaza kimliği, URL'deki alt alan adıyla eşleşmeli
    const magaza = (process.env.BLOB_READ_WRITE_TOKEN || '').split('_')[3]?.toLowerCase();
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com')
      && (!magaza || u.hostname.startsWith(magaza + '.'))
      && u.pathname.startsWith('/anilar/');
  } catch {
    return false;
  }
}

export async function dosyaSil(url: string) {
  if (!url) return;
  if (url.startsWith('/medya/')) {
    const yol = yerelYol(url.slice('/medya/'.length).split('/'));
    if (yol) await rm(yol, { force: true });
    return;
  }
  if (depolamaTuru() === 'blob') {
    const { del } = await import('@vercel/blob');
    await del(url).catch(() => {});
  }
}
