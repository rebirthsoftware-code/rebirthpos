import type { Metadata } from 'next';
import Link from 'next/link';
import Duvar from '@/components/duvar/Duvar';
import { anilariListele, sayilar } from '@/lib/anilar';
import { MEKAN } from '@/lib/ayarlar';
import { cihazKimligi } from '@/lib/kimlik';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Anı Duvarı' };

export default async function DuvarSayfasi({ searchParams }: { searchParams: Promise<{ yeni?: string }> }) {
  const { yeni } = await searchParams;
  const [ilk, s] = await Promise.all([anilariListele({ limit: 24, cihaz: await cihazKimligi() }), sayilar()]);
  return (
    <main className="kap genis">
      <section className="duvar-bas">
        <div>
          <p className="ust-yazi">{MEKAN.ad}</p>
          <h1>Anı Duvarı</h1>
          <p className="aciklama">Misafirlerimizin burada bıraktığı anlar. Sen de bir tane bırakmak ister misin?</p>
          <dl className="duvar-sayac">
            <div><dt>Anı</dt><dd>{s.yayinda}</dd></div>
            <div><dt>Fotoğraf</dt><dd>{s.foto}</dd></div>
            <div><dt>Video</dt><dd>{s.video}</dd></div>
            <div><dt>Sesli not</dt><dd>{s.ses}</dd></div>
          </dl>
        </div>
        <Link className="gonder kucuk" href="/">+ Anı Bırak</Link>
      </section>
      <Duvar ilk={ilk} yeniId={Number(yeni) || undefined} />
    </main>
  );
}
