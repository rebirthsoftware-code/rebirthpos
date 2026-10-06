import UstBar from '@/components/UstBar';
import Yapraklar from '@/components/Yapraklar';
import { MEKAN } from '@/lib/ayarlar';

export default function SiteYerlesimi({ children }: { children: React.ReactNode }) {
  return (
    <>
      <UstBar mekan={MEKAN.ad} />
      <Yapraklar />
      {children}
      <footer className="site-alt">
        <span>{MEKAN.ad}{MEKAN.konum ? ` · ${MEKAN.konum}` : ''}</span>
        {MEKAN.instagram && <a href={`https://instagram.com/${MEKAN.instagram}`} target="_blank" rel="noopener">@{MEKAN.instagram}</a>}
      </footer>
    </>
  );
}
