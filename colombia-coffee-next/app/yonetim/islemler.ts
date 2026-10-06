'use server';
// Yönetim işlemleri (Server Actions) — her biri yönetici oturumunu kendisi doğrular
import { redirect } from 'next/navigation';
import { anilariListele, ayarYaz } from '@/lib/anilar';
import { sql, semaHazir } from '@/lib/db';
import { dosyaSil } from '@/lib/depolama';
import { hizSiniri } from '@/lib/hizSiniri';
import { ipOzeti, sifreDogru, yoneticiGerekli, yoneticiOturumuAc, yoneticiOturumuKapat } from '@/lib/kimlik';
import type { AniDurumu } from '@/lib/tipler';

export async function girisYap(_onceki: { hata?: string } | undefined, form: FormData): Promise<{ hata?: string }> {
  const ip = await ipOzeti();
  if (!hizSiniri(`giris:${ip}`, 8, 600)) return { hata: 'Çok fazla deneme. 10 dakika sonra tekrar dene.' };
  if (!sifreDogru(String(form.get('sifre') ?? ''))) return { hata: 'Şifre yanlış.' };
  await yoneticiOturumuAc();
  redirect('/yonetim');
}

export async function cikisYap() {
  await yoneticiOturumuKapat();
  redirect('/yonetim');
}

export async function listele(durum: AniDurumu | 'hepsi', once?: number) {
  await yoneticiGerekli();
  return anilariListele({ durum, once, limit: 30 });
}

export async function durumDegistir(id: number, durum: AniDurumu) {
  await yoneticiGerekli();
  if (!['yayinda', 'gizli', 'bekliyor'].includes(durum)) throw new Error('Geçersiz durum');
  await semaHazir();
  await sql`UPDATE ani_anilar SET durum = ${durum} WHERE id = ${id}`;
}

export async function kaliciSil(id: number) {
  await yoneticiGerekli();
  await semaHazir();
  const medya = await sql<{ url: string; onizleme: string }[]>`SELECT url, onizleme FROM ani_medyalar WHERE ani_id = ${id}`;
  await sql`DELETE FROM ani_anilar WHERE id = ${id}`;
  await Promise.all(medya.flatMap((m) => [dosyaSil(m.url), dosyaSil(m.onizleme)]));
}

export async function onayModu(acik: boolean) {
  await yoneticiGerekli();
  await ayarYaz('onay_gerekli', acik ? '1' : '0');
}

export async function bekleyenleriYayinla() {
  await yoneticiGerekli();
  await semaHazir();
  await sql`UPDATE ani_anilar SET durum = 'yayinda' WHERE durum = 'bekliyor'`;
}
