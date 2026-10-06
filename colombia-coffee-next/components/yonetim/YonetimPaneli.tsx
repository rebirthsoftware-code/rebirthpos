'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Ani, AniDurumu } from '@/lib/tipler';
import { bekleyenleriYayinla, cikisYap, durumDegistir, kaliciSil, listele, onayModu } from '@/app/yonetim/islemler';

const DURUM: Record<AniDurumu, [string, string]> = {
  yayinda: ['Yayında', 'yesil'], bekliyor: ['Onay bekliyor', 'sari'], gizli: ['Gizli', 'gri'],
};
const FILTRE: Array<[AniDurumu | 'hepsi', string]> = [['hepsi', 'Tümü'], ['bekliyor', 'Onay bekleyen'], ['yayinda', 'Yayında'], ['gizli', 'Gizlenen']];

interface Sayilar { yayinda: number; bekliyor: number; gizli: number; bugun: number; foto: number; video: number; ses: number }

export default function YonetimPaneli({ ilk, sayilar, onayli, qr, url, mekan, uyari }: {
  ilk: Ani[]; sayilar: Sayilar; onayli: boolean; qr: string; url: string; mekan: string; uyari: boolean;
}) {
  const router = useRouter();
  const [anilar, setAnilar] = useState(ilk);
  const [filtre, setFiltre] = useState<AniDurumu | 'hepsi'>('hepsi');
  const [devami, setDevami] = useState(ilk.length === 30);
  const [onay, setOnay] = useState(onayli);
  const [silinecek, setSilinecek] = useState<number | null>(null);
  const [bekliyor, basla] = useTransition();

  const yenile = (f = filtre) => basla(async () => {
    const l = await listele(f);
    setAnilar(l);
    setDevami(l.length === 30);
    router.refresh(); // sayaçlar
  });

  function durum(id: number, d: AniDurumu) {
    basla(async () => {
      await durumDegistir(id, d);
      setAnilar((a) => (filtre === 'hepsi' ? a.map((x) => (x.id === id ? { ...x, durum: d } : x)) : a.filter((x) => x.id !== id)));
      router.refresh();
    });
  }

  function sil(id: number) {
    basla(async () => {
      await kaliciSil(id);
      setAnilar((a) => a.filter((x) => x.id !== id));
      setSilinecek(null);
      router.refresh();
    });
  }

  function qrYazdir() {
    const w = window.open('', '_blank', 'width=520,height=700');
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Masa kartı</title>
      <style>body{margin:0;display:flex;justify-content:center;font-family:Georgia,serif;color:#1f3a2b}
      .k{width:90mm;border:2px solid #1f3a2b;border-radius:6mm;padding:8mm;text-align:center;margin-top:10mm}
      h1{margin:0 0 4mm;font-size:22pt}.q svg{width:58mm;height:58mm}p{margin:4mm 0 0;font-size:15pt}
      small{font:10pt Arial,sans-serif;color:#5a6b5f}</style></head><body>
      <div class="k"><h1>${mekan.replace(/</g, '&lt;')}</h1><div class="q">${qr}</div><p>Anını bırak 🌿</p>
      <small>Kameranla okut, fotoğrafını paylaş</small></div>
      <script>window.onload=()=>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }

  return (
    <main className="kap genis yonetim">
      <section className="duvar-bas">
        <div>
          <p className="ust-yazi">{mekan}</p>
          <h1>Anı Duvarı · Yönetim</h1>
        </div>
        <div className="satir-butonlar">
          <a className="metin-btn" href="/duvar" target="_blank">Duvarı aç ↗</a>
          <a className="metin-btn" href="/ekran" target="_blank">TV ekranı ↗</a>
          <form action={cikisYap}><button className="metin-btn">Çıkış</button></form>
        </div>
      </section>

      {uyari && <p className="hata-kutu">YONETICI_SIFRE tanımlı değil ya da varsayılan değerde. Ortam değişkenlerinden güçlü bir şifre verin.</p>}

      <div className="istatistik">
        <div className="kart"><small>Yayında</small><b>{sayilar.yayinda}</b></div>
        <div className="kart"><small>Onay bekleyen</small><b className={sayilar.bekliyor ? 'vurgu' : ''}>{sayilar.bekliyor}</b></div>
        <div className="kart"><small>Son 24 saat</small><b>{sayilar.bugun}</b></div>
        <div className="kart"><small>Gizlenen</small><b>{sayilar.gizli}</b></div>
        <div className="kart"><small>Fotoğraf · Video · Ses</small><b>{sayilar.foto} · {sayilar.video} · {sayilar.ses}</b></div>
      </div>

      <div className="yonetim-izgara">
        <section className={bekliyor ? 'soluk' : ''}>
          <div className="filtreler">
            {FILTRE.map(([d, ad]) => (
              <button key={d} className={filtre === d ? 'aktif' : ''} onClick={() => { setFiltre(d); yenile(d); }}>{ad}</button>
            ))}
            {sayilar.bekliyor > 0 && (
              <button className="metin-btn sag-yasla" onClick={() => basla(async () => { await bekleyenleriYayinla(); yenile(); })}>
                Bekleyen {sayilar.bekliyor} anıyı yayınla
              </button>
            )}
          </div>

          <div className="yonetim-liste">
            {!anilar.length && <p className="duvar-bos">Bu filtrede anı yok.</p>}
            {anilar.map((a) => {
              const [ad, renk] = DURUM[a.durum];
              return (
                <article key={a.id} className="kart y-ani">
                  <div className="y-medya">
                    {a.medya.map((m, i) => m.tur === 'foto'
                      ? <a key={i} href={m.url} target="_blank" rel="noopener"><img src={m.onizleme || m.url} alt="" loading="lazy" /></a>
                      : m.tur === 'video'
                        ? <video key={i} src={m.url} poster={m.onizleme || undefined} controls preload="none" />
                        : <audio key={i} src={m.url} controls preload="none" />)}
                  </div>
                  <div className="y-bilgi">
                    {a.not && <p className="kart-not">{a.not}</p>}
                    <p className="kucuk-yazi">#{a.id} · {a.isim || 'isimsiz'} · {new Date(a.tarih).toLocaleString('tr-TR')} · {Object.entries(a.tepkiler).map(([e, n]) => `${e} ${n}`).join('  ')}</p>
                    <div className="satir-butonlar">
                      <span className={`rozet ${renk}`}>{ad}</span>
                      {a.durum !== 'yayinda' && <button className="metin-btn" onClick={() => durum(a.id, 'yayinda')}>Yayınla</button>}
                      {a.durum !== 'gizli' && <button className="metin-btn" onClick={() => durum(a.id, 'gizli')}>Gizle</button>}
                      {silinecek === a.id
                        ? <>
                            <button className="metin-btn tehlike dolu" onClick={() => sil(a.id)}>Evet, kalıcı sil</button>
                            <button className="metin-btn" onClick={() => setSilinecek(null)}>Vazgeç</button>
                          </>
                        : <button className="metin-btn tehlike" onClick={() => setSilinecek(a.id)}>Sil</button>}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {devami && (
            <button className="metin-btn daha" onClick={() => basla(async () => {
              const l = await listele(filtre, anilar[anilar.length - 1]?.id);
              setAnilar((a) => [...a, ...l]);
              setDevami(l.length === 30);
            })}>Daha fazla</button>
          )}
        </section>

        <aside className="kart yan">
          <h2>Ayarlar</h2>
          <label className="anahtar">
            <input type="checkbox" checked={onay} onChange={(e) => { const v = e.target.checked; setOnay(v); basla(() => onayModu(v)); }} />
            <span>Yayından önce onay iste</span>
          </label>
          <p className="kucuk-yazi">Açıkken yeni anılar siz onaylayana kadar duvarda görünmez. Kalabalık etkinliklerde önerilir.</p>

          <h2>Masa QR kartı</h2>
          <div className="qr-kart">
            <div className="qr-kart-ust">{mekan}</div>
            <div className="qr-kutu" dangerouslySetInnerHTML={{ __html: qr }} />
            <div className="qr-kart-alt">Anını bırak 🌿<br /><small>Kameranla okut, fotoğrafını paylaş</small></div>
          </div>
          <p className="kucuk-yazi">Bağlantı: <a href={url} target="_blank" rel="noopener">{url}</a></p>
          <button className="gonder kucuk tam" onClick={qrYazdir}>QR kartını yazdır</button>
        </aside>
      </div>
    </main>
  );
}
