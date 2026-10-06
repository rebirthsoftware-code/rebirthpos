import type { Metadata } from 'next';
import Slayt from '@/components/Slayt';
import { anilariListele } from '@/lib/anilar';
import { MEKAN } from '@/lib/ayarlar';
import { qrSvg, siteUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Ekran' };

// Kafedeki TV / projeksiyon için tam ekran slayt
export default async function Ekran() {
  const url = await siteUrl();
  const [ilk, qr] = await Promise.all([anilariListele({ limit: 60 }), qrSvg(url + '/')]);
  return <Slayt ilk={ilk} qr={qr} mekan={MEKAN.ad} />;
}
