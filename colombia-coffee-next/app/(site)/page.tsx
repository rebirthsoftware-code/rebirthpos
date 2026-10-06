import Link from 'next/link';
import AniFormu from '@/components/AniFormu';
import { onayGerekli, sayilar } from '@/lib/anilar';
import { MEKAN, SINIR, depolamaTuru } from '@/lib/ayarlar';

export const dynamic = 'force-dynamic';

export default async function AniBirak() {
  const [s, onayli] = await Promise.all([sayilar(), onayGerekli()]);
  return (
    <main className="kap">
      <section className="giris">
        <p className="ust-yazi">Hoş geldin{MEKAN.konum ? ` · ${MEKAN.konum}` : ''}</p>
        <h1>{MEKAN.ad}</h1>
        <p className="slogan">{MEKAN.slogan}</p>
        <p className="aciklama">
          Burada yaşadığın anı bizimle paylaş. Fotoğrafın, videon ya da sesli notun <Link href="/duvar">Anı Duvarı</Link>&apos;nda herkesle buluşsun.
        </p>
        {s.yayinda > 0 && (
          <Link className="duvar-rozet" href="/duvar">
            <span>{s.yayinda}</span> anı duvarda seni bekliyor
            {s.bugun > 0 && <em> · bugün {s.bugun}</em>} →
          </Link>
        )}
      </section>
      <AniFormu
        depolama={depolamaTuru()}
        onayli={onayli}
        sinir={{ fotoMb: SINIR.fotoMb, videoMb: SINIR.videoMb, sesMb: SINIR.sesMb, dosya: SINIR.dosya, not: SINIR.not, isim: SINIR.isim }}
      />
    </main>
  );
}
