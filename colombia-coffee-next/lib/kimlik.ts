import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies, headers } from 'next/headers';

const YONETICI_CEREZ = 'cc_yonetici';
const CIHAZ_CEREZ = 'cc_cihaz';
const OTURUM_SURESI = 60 * 60 * 12; // 12 saat

function sir(): string {
  const s = process.env.OTURUM_SIRRI || process.env.YONETICI_SIFRE || '';
  if (!s) throw new Error('OTURUM_SIRRI veya YONETICI_SIFRE tanımlı olmalı');
  return s;
}

const imza = (veri: string) => createHmac('sha256', sir()).update(veri).digest('hex');

function esitMi(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- Yönetici ----------
export function sifreDogru(girilen: string): boolean {
  const dogru = process.env.YONETICI_SIFRE || '';
  if (!dogru) return false;
  // Uzunluk sızdırmamak için özetleri karşılaştır
  const h = (s: string) => createHash('sha256').update(s).digest('hex');
  return esitMi(h(girilen), h(dogru));
}

export async function yoneticiOturumuAc() {
  const bitis = Math.floor(Date.now() / 1000) + OTURUM_SURESI;
  (await cookies()).set(YONETICI_CEREZ, `${bitis}.${imza(`yonetici.${bitis}`)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: OTURUM_SURESI,
  });
}

export async function yoneticiOturumuKapat() {
  (await cookies()).delete(YONETICI_CEREZ);
}

export async function yoneticiMi(): Promise<boolean> {
  const deger = (await cookies()).get(YONETICI_CEREZ)?.value;
  if (!deger) return false;
  const [bitis, im] = deger.split('.');
  if (!bitis || !im || Number(bitis) < Date.now() / 1000) return false;
  return esitMi(im, imza(`yonetici.${bitis}`));
}

export async function yoneticiGerekli() {
  if (!(await yoneticiMi())) throw new Error('Yetkisiz');
}

// ---------- Anonim cihaz kimliği (tepki ve hız sınırı için) ----------
/** Okur; yoksa üretip çerez olarak yazar (yalnız Route Handler / Server Action içinde yazılabilir). */
export async function cihazKimligi(yaz = false): Promise<string> {
  const c = await cookies();
  const mevcut = c.get(CIHAZ_CEREZ)?.value;
  if (mevcut) {
    const [id, im] = mevcut.split('.');
    if (id && im && esitMi(im, imza(`cihaz.${id}`).slice(0, 16))) return id;
  }
  if (!yaz) return '';
  const id = randomBytes(12).toString('hex');
  c.set(CIHAZ_CEREZ, `${id}.${imza(`cihaz.${id}`).slice(0, 16)}`, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}

/** IP adresinin tuzlu özeti — IP açık saklanmaz */
export async function ipOzeti(): Promise<string> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '';
  return imza(`ip.${ip}`).slice(0, 32);
}
