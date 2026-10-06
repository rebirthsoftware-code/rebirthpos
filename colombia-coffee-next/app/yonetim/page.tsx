import type { Metadata } from 'next';
import GirisFormu from '@/components/yonetim/GirisFormu';
import YonetimPaneli from '@/components/yonetim/YonetimPaneli';
import Yapraklar from '@/components/Yapraklar';
import { anilariListele, onayGerekli, sayilar } from '@/lib/anilar';
import { MEKAN } from '@/lib/ayarlar';
import { yoneticiMi } from '@/lib/kimlik';
import { qrSvg, siteUrl } from '@/lib/qr';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Yönetim', robots: { index: false } };

export default async function Yonetim() {
  if (!(await yoneticiMi())) {
    return (
      <>
        <Yapraklar />
        <main className="kap dar"><GirisFormu mekan={MEKAN.ad} /></main>
      </>
    );
  }
  const url = (await siteUrl()) + '/';
  const [ilk, s, onay, qr] = await Promise.all([anilariListele({ durum: 'hepsi', limit: 30 }), sayilar(), onayGerekli(), qrSvg(url, '#1f3a2b', '#ffffff')]);
  const varsayilanSifre = !process.env.YONETICI_SIFRE || process.env.YONETICI_SIFRE === 'degistir-beni';
  return <YonetimPaneli ilk={ilk} sayilar={s} onayli={onay} qr={qr} url={url} mekan={MEKAN.ad} uyari={varsayilanSifre} />;
}
