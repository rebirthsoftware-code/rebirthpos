import { TEPKILER } from '@/lib/ayarlar';
import { sql, semaHazir } from '@/lib/db';
import { hizSiniri } from '@/lib/hizSiniri';
import { cihazKimligi } from '@/lib/kimlik';

// POST /api/anilar/12/tepki { emoji: "☕" } — aynı tepkiye tekrar basmak geri alır
export async function POST(istek: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const { emoji } = (await istek.json().catch(() => ({}))) as { emoji?: string };
  if (!id || !TEPKILER.includes(emoji as (typeof TEPKILER)[number])) return Response.json({ hata: 'Geçersiz tepki' }, { status: 400 });

  const cihaz = await cihazKimligi(true);
  if (!hizSiniri(`tepki:${cihaz}`, 60, 60)) return Response.json({ hata: 'Biraz yavaş 🙂' }, { status: 429 });

  await semaHazir();
  const [ani] = await sql`SELECT id FROM ani_anilar WHERE id = ${id} AND durum = 'yayinda'`;
  if (!ani) return Response.json({ hata: 'Anı bulunamadı' }, { status: 404 });

  const silinen = await sql`DELETE FROM ani_tepkiler WHERE ani_id = ${id} AND emoji = ${emoji!} AND cihaz = ${cihaz} RETURNING 1`;
  if (!silinen.length) await sql`INSERT INTO ani_tepkiler (ani_id, emoji, cihaz) VALUES (${id}, ${emoji!}, ${cihaz}) ON CONFLICT DO NOTHING`;

  const satirlar = await sql<{ emoji: string; n: number }[]>`
    SELECT emoji, COUNT(*)::int AS n FROM ani_tepkiler WHERE ani_id = ${id} GROUP BY emoji`;
  const benim = await sql<{ emoji: string }[]>`SELECT emoji FROM ani_tepkiler WHERE ani_id = ${id} AND cihaz = ${cihaz}`;
  return Response.json({
    tepkiler: Object.fromEntries(satirlar.map((r) => [r.emoji, r.n])),
    benim: benim.map((r) => r.emoji),
  });
}
