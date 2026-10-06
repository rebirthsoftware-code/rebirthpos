import 'server-only';
import { sql, semaHazir } from './db';
import type { Ani, AniDurumu, Medya, MedyaTuru } from './tipler';

export interface ListeSecenek {
  durum?: AniDurumu | 'hepsi';
  tur?: MedyaTuru | 'not' | '';
  once?: number; // bu id'den eskiler (sayfalama)
  sonra?: number; // bu id'den yeniler (canlı akış)
  limit?: number;
  cihaz?: string;
}

export async function anilariListele(s: ListeSecenek = {}): Promise<Ani[]> {
  await semaHazir();
  const limit = Math.min(Math.max(s.limit ?? 24, 1), 60);
  const durum = s.durum ?? 'yayinda';
  const satirlar = await sql<{ id: number; isim: string; not_metni: string; durum: AniDurumu; olusturma: Date }[]>`
    SELECT id, isim, not_metni, durum, olusturma FROM ani_anilar a
    WHERE ${durum === 'hepsi' ? sql`TRUE` : sql`durum = ${durum}`}
      ${s.once ? sql`AND id < ${s.once}` : sql``}
      ${s.sonra ? sql`AND id > ${s.sonra}` : sql``}
      ${s.tur === 'not' ? sql`AND not_metni <> ''` : sql``}
      ${s.tur && s.tur !== 'not' ? sql`AND EXISTS (SELECT 1 FROM ani_medyalar m WHERE m.ani_id = a.id AND m.tur = ${s.tur})` : sql``}
    ORDER BY id DESC
    LIMIT ${limit}`;
  if (!satirlar.length) return [];
  const idler = satirlar.map((r) => r.id);

  const [medyalar, tepkiler, benim] = await Promise.all([
    sql<{ ani_id: number; tur: MedyaTuru; url: string; onizleme: string; mime: string; genislik: number; yukseklik: number; sure: number }[]>`
      SELECT ani_id, tur, url, onizleme, mime, genislik, yukseklik, sure FROM ani_medyalar
      WHERE ani_id = ANY(${idler}) ORDER BY sira, id`,
    sql<{ ani_id: number; emoji: string; n: number }[]>`
      SELECT ani_id, emoji, COUNT(*)::int AS n FROM ani_tepkiler WHERE ani_id = ANY(${idler}) GROUP BY ani_id, emoji`,
    s.cihaz
      ? sql<{ ani_id: number; emoji: string }[]>`SELECT ani_id, emoji FROM ani_tepkiler WHERE ani_id = ANY(${idler}) AND cihaz = ${s.cihaz}`
      : Promise.resolve([] as { ani_id: number; emoji: string }[]),
  ]);

  const medyaHarita = new Map<number, Medya[]>();
  for (const m of medyalar) {
    const liste = medyaHarita.get(m.ani_id) ?? [];
    liste.push({ tur: m.tur, url: m.url, onizleme: m.onizleme, mime: m.mime, g: m.genislik, y: m.yukseklik, sure: m.sure });
    medyaHarita.set(m.ani_id, liste);
  }
  const tepkiHarita = new Map<number, Record<string, number>>();
  for (const t of tepkiler) tepkiHarita.set(t.ani_id, { ...tepkiHarita.get(t.ani_id), [t.emoji]: t.n });
  const benimHarita = new Map<number, string[]>();
  for (const b of benim) benimHarita.set(b.ani_id, [...(benimHarita.get(b.ani_id) ?? []), b.emoji]);

  return satirlar.map((r) => ({
    id: r.id,
    isim: r.isim,
    not: r.not_metni,
    durum: r.durum,
    tarih: r.olusturma.toISOString(),
    medya: medyaHarita.get(r.id) ?? [],
    tepkiler: tepkiHarita.get(r.id) ?? {},
    benim: benimHarita.get(r.id) ?? [],
  }));
}

export async function sayilar() {
  await semaHazir();
  const [d] = await sql<{ yayinda: number; bekliyor: number; gizli: number; bugun: number }[]>`
    SELECT
      COUNT(*) FILTER (WHERE durum = 'yayinda')::int AS yayinda,
      COUNT(*) FILTER (WHERE durum = 'bekliyor')::int AS bekliyor,
      COUNT(*) FILTER (WHERE durum = 'gizli')::int AS gizli,
      COUNT(*) FILTER (WHERE durum = 'yayinda' AND olusturma > now() - interval '24 hours')::int AS bugun
    FROM ani_anilar`;
  const medya = await sql<{ tur: string; n: number }[]>`
    SELECT m.tur, COUNT(*)::int AS n FROM ani_medyalar m JOIN ani_anilar a ON a.id = m.ani_id
    WHERE a.durum = 'yayinda' GROUP BY m.tur`;
  const m = Object.fromEntries(medya.map((x) => [x.tur, x.n])) as Record<string, number>;
  return { ...d, foto: m.foto ?? 0, video: m.video ?? 0, ses: m.ses ?? 0 };
}

export async function ayarOku(anahtar: string): Promise<string | null> {
  await semaHazir();
  const [r] = await sql<{ deger: string }[]>`SELECT deger FROM ani_ayarlar WHERE anahtar = ${anahtar}`;
  return r?.deger ?? null;
}

export async function ayarYaz(anahtar: string, deger: string) {
  await semaHazir();
  await sql`INSERT INTO ani_ayarlar (anahtar, deger) VALUES (${anahtar}, ${deger})
            ON CONFLICT (anahtar) DO UPDATE SET deger = EXCLUDED.deger`;
}

export async function onayGerekli(): Promise<boolean> {
  const v = await ayarOku('onay_gerekli');
  return v === null ? process.env.ONAY_GEREKLI === 'true' : v === '1';
}
