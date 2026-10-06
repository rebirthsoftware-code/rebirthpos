import type { Metadata, Viewport } from 'next';
import { Caveat, Figtree, Fraunces } from 'next/font/google';
import { MEKAN } from '@/lib/ayarlar';
import './globals.css';

// Fontlar derleme sırasında indirilip uygulamanın kendisinden sunulur (Google'a istek gitmez)
const baslik = Fraunces({ subsets: ['latin', 'latin-ext'], variable: '--font-baslik', axes: ['opsz'], display: 'swap' });
const govde = Figtree({ subsets: ['latin', 'latin-ext'], variable: '--font-govde', display: 'swap' });
const el = Caveat({ subsets: ['latin', 'latin-ext'], variable: '--font-el', display: 'swap' });

export const metadata: Metadata = {
  title: { default: `${MEKAN.ad} · Anı Duvarı`, template: `%s · ${MEKAN.ad}` },
  description: `${MEKAN.ad}'de yaşadığın anı paylaş: fotoğraf, video, sesli not ya da birkaç satır. Hepsi Anı Duvarı'nda.`,
  applicationName: `${MEKAN.ad} Anı Duvarı`,
  openGraph: { title: `${MEKAN.ad} · Anı Duvarı`, description: MEKAN.slogan, type: 'website', locale: 'tr_TR' },
};

export const viewport: Viewport = {
  themeColor: '#1f3a2b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function KokYerlesim({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${baslik.variable} ${govde.variable} ${el.variable}`}>
      <body>{children}</body>
    </html>
  );
}
