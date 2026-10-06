// Yerel depolamadaki dosyaları sunar (Vercel Blob kullanılıyorsa bu uç devreye girmez).
// Range desteği: Safari ve iOS videoyu ancak parça parça isteyebildiğinde oynatır.
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { yerelYol } from '@/lib/depolama';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', '3gp': 'video/3gpp', m4v: 'video/x-m4v',
  ogg: 'audio/ogg', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
};

export async function GET(istek: Request, { params }: { params: Promise<{ yol: string[] }> }) {
  const dosya = yerelYol((await params).yol);
  if (!dosya) return new Response('Bulunamadı', { status: 404 });
  let boyut: number;
  try {
    const s = await stat(dosya);
    if (!s.isFile()) throw new Error();
    boyut = s.size;
  } catch {
    return new Response('Bulunamadı', { status: 404 });
  }
  const tur = MIME[path.extname(dosya).slice(1).toLowerCase()] ?? 'application/octet-stream';
  const ortak = {
    'Content-Type': tur,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
  };

  const aralik = istek.headers.get('range')?.match(/^bytes=(\d*)-(\d*)$/);
  if (aralik) {
    let bas = aralik[1] ? Number(aralik[1]) : boyut - Number(aralik[2]);
    let son = aralik[1] && aralik[2] ? Number(aralik[2]) : boyut - 1;
    bas = Math.max(0, bas);
    son = Math.min(son, boyut - 1);
    if (bas > son) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${boyut}` } });
    const akis = Readable.toWeb(createReadStream(dosya, { start: bas, end: son })) as ReadableStream;
    return new Response(akis, {
      status: 206,
      headers: { ...ortak, 'Content-Range': `bytes ${bas}-${son}/${boyut}`, 'Content-Length': String(son - bas + 1) },
    });
  }
  const akis = Readable.toWeb(createReadStream(dosya)) as ReadableStream;
  return new Response(akis, { headers: { ...ortak, 'Content-Length': String(boyut) } });
}
