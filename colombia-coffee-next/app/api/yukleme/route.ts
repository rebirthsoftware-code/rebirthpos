// Dosya yükleme
//  • Vercel Blob varsa: tarayıcı dosyayı doğrudan Blob'a yükler; bu uç yalnız kısa ömürlü,
//    tür ve boyutu kısıtlanmış bir yükleme izni (token) verir. Büyük videolar sunucuya uğramaz.
//  • Yoksa (kendi sunucunda): dosya bu uca gövde olarak gelir ve diske akış hâlinde yazılır.
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { depolamaTuru } from '@/lib/ayarlar';
import { IZINLI, MAKS_BAYT, yereleKaydet } from '@/lib/depolama';
import { hizSiniri } from '@/lib/hizSiniri';
import { ipOzeti } from '@/lib/kimlik';
import type { MedyaTuru } from '@/lib/tipler';

const TURLER: MedyaTuru[] = ['foto', 'video', 'ses'];

export async function POST(istek: Request): Promise<Response> {
  const ip = await ipOzeti();
  if (!hizSiniri(`yukleme:${ip}`, 80, 600)) {
    return Response.json({ hata: 'Çok fazla yükleme yapıldı, biraz sonra tekrar dene.' }, { status: 429 });
  }

  if (depolamaTuru() === 'blob') {
    const govde = (await istek.json()) as HandleUploadBody;
    try {
      const sonuc = await handleUpload({
        body: govde,
        request: istek,
        onBeforeGenerateToken: async (yol, yuk) => {
          const tur = (JSON.parse(yuk || '{}') as { tur?: MedyaTuru }).tur;
          if (!tur || !TURLER.includes(tur) || !yol.startsWith(`anilar/${tur}/`)) throw new Error('Geçersiz yükleme');
          return {
            allowedContentTypes: Object.keys(IZINLI[tur]),
            maximumSizeInBytes: MAKS_BAYT[tur],
            addRandomSuffix: true,
            cacheControlMaxAge: 60 * 60 * 24 * 365,
          };
        },
      });
      return Response.json(sonuc);
    } catch (e) {
      return Response.json({ hata: (e as Error).message || 'Yükleme izni alınamadı' }, { status: 400 });
    }
  }

  // Yerel depolama
  const tur = new URL(istek.url).searchParams.get('tur') as MedyaTuru | null;
  if (!tur || !TURLER.includes(tur)) return Response.json({ hata: 'Geçersiz tür' }, { status: 400 });
  const uzunluk = Number(istek.headers.get('content-length') || 0);
  if (uzunluk > MAKS_BAYT[tur]) return Response.json({ hata: 'Dosya çok büyük' }, { status: 413 });
  if (!istek.body) return Response.json({ hata: 'Dosya yok' }, { status: 400 });
  try {
    return Response.json(await yereleKaydet(istek.body, tur));
  } catch (e) {
    return Response.json({ hata: (e as Error).message }, { status: 400 });
  }
}
