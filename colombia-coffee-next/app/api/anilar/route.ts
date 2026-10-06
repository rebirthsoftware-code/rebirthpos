import { anilariListele, onayGerekli } from '@/lib/anilar';
import { SINIR } from '@/lib/ayarlar';
import { sql, semaHazir } from '@/lib/db';
import { IZINLI, urlBizimMi } from '@/lib/depolama';
import { cihazKimligi, ipOzeti } from '@/lib/kimlik';
import type { MedyaTuru, YuklenenMedya } from '@/lib/tipler';

// GET /api/anilar?tur=foto&once=120&sonra=130&limit=24 — duvar listesi (yalnız yayındakiler)
export async function GET(istek: Request) {
  const q = new URL(istek.url).searchParams;
  const tur = (q.get('tur') || '') as MedyaTuru | 'not' | '';
  const anilar = await anilariListele({
    tur: ['foto', 'video', 'ses', 'not'].includes(tur) ? tur : '',
    once: Number(q.get('once')) || undefined,
    sonra: Number(q.get('sonra')) || undefined,
    limit: Number(q.get('limit')) || 24,
    cihaz: await cihazKimligi(),
  });
  return Response.json({ anilar }, { headers: { 'Cache-Control': 'no-store' } });
}

// POST /api/anilar — yükleme bittikten sonra anıyı kaydeder
export async function POST(istek: Request) {
  let g: { isim?: string; not?: string; medya?: YuklenenMedya[]; web_sitesi?: string };
  try { g = await istek.json(); } catch { return Response.json({ hata: 'Geçersiz istek' }, { status: 400 }); }

  // Bot tuzağı: gizli alan doluysa sessizce "başarılı" de
  if (g.web_sitesi) return Response.json({ ok: true, durum: 'yayinda' });

  const isim = String(g.isim ?? '').replace(/[<>]/g, '').trim().slice(0, SINIR.isim);
  const not = String(g.not ?? '').replace(/\r/g, '').trim().slice(0, SINIR.not);
  const medya = Array.isArray(g.medya) ? g.medya.slice(0, SINIR.dosya + 1) : [];
  if (!medya.length && !not) return Response.json({ hata: 'Paylaşmak için bir fotoğraf, video, ses kaydı ya da not ekle.' }, { status: 400 });
  if (medya.length > SINIR.dosya) return Response.json({ hata: `Bir seferde en fazla ${SINIR.dosya} dosya gönderebilirsin.` }, { status: 400 });

  for (const m of medya) {
    const tur = m.tur as MedyaTuru;
    if (!['foto', 'video', 'ses'].includes(tur)) return Response.json({ hata: 'Geçersiz medya' }, { status: 400 });
    if (!IZINLI[tur][m.mime] && !(tur === 'ses' && m.mime.startsWith('video/'))) return Response.json({ hata: 'Desteklenmeyen dosya türü' }, { status: 400 });
    if (!(await urlBizimMi(m.url)) || (m.onizleme && !(await urlBizimMi(m.onizleme)))) {
      return Response.json({ hata: 'Dosya bulunamadı, tekrar yüklemeyi dene.' }, { status: 400 });
    }
  }

  await semaHazir();
  const cihaz = await cihazKimligi(true);
  const ip = await ipOzeti();
  const [{ n }] = await sql<{ n: number }[]>`
    SELECT COUNT(*)::int AS n FROM ani_anilar
    WHERE (cihaz = ${cihaz} OR ip_ozet = ${ip}) AND olusturma > now() - interval '1 hour'`;
  if (n >= SINIR.saatlik) return Response.json({ hata: 'Kısa sürede çok fazla anı gönderildi. Biraz sonra tekrar dene.' }, { status: 429 });

  const durum = (await onayGerekli()) ? 'bekliyor' : 'yayinda';
  const id = await sql.begin(async (tx) => {
    const [a] = await tx<{ id: number }[]>`
      INSERT INTO ani_anilar (isim, not_metni, durum, cihaz, ip_ozet) VALUES (${isim}, ${not}, ${durum}, ${cihaz}, ${ip}) RETURNING id`;
    for (const [sira, m] of medya.entries()) {
      await tx`
        INSERT INTO ani_medyalar (ani_id, tur, url, onizleme, mime, genislik, yukseklik, sure, sira)
        VALUES (${a.id}, ${m.tur}, ${m.url}, ${m.onizleme ?? ''}, ${m.mime},
                ${Math.round(Number(m.g) || 0)}, ${Math.round(Number(m.y) || 0)}, ${Number(m.sure) || 0}, ${sira})`;
    }
    return a.id;
  });

  return Response.json({ ok: true, id, durum });
}
