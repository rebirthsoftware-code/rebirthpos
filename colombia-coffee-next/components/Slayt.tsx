'use client';
import { useEffect, useRef, useState } from 'react';
import type { Ani } from '@/lib/tipler';
import { goreliZaman } from '@/lib/istemci/zaman';

const SURE_MS = 9000;
const YOKLAMA_MS = 15000;

/** TV slayt gösterisi: polaroid fotoğraflar, el yazısı notlar, yeni anı gelince hemen sırada "Yeni" etiketiyle */
export default function Slayt({ ilk, qr, mekan }: { ilk: Ani[]; qr: string; mekan: string }) {
  const kuyruk = useRef<Ani[]>(ilk);
  const sira = useRef(0);
  const enYeni = useRef(Math.max(0, ...ilk.map((a) => a.id)));
  const yeniler = useRef(new Set<number>());
  const [simdiki, setSimdiki] = useState<{ ani: Ani; anahtar: number; yeni: boolean } | null>(null);
  const [onceki, setOnceki] = useState<{ ani: Ani; anahtar: number; yeni: boolean } | null>(null);
  const [saat, setSaat] = useState('');
  const [sayi, setSayi] = useState(ilk.length);
  const simdikiRef = useRef<{ ani: Ani; anahtar: number; yeni: boolean } | null>(null);
  const zamanlayici = useRef<ReturnType<typeof setTimeout>>(undefined);

  function sonraki() {
    clearTimeout(zamanlayici.current);
    const k = kuyruk.current;
    if (!k.length) { zamanlayici.current = setTimeout(sonraki, 5000); return; }
    if (sira.current >= k.length) sira.current = 0;
    const ani = k[sira.current++];
    const yeni = yeniler.current.delete(ani.id);
    setOnceki(simdikiRef.current);
    simdikiRef.current = { ani, anahtar: Date.now(), yeni };
    setSimdiki(simdikiRef.current);
    const video = ani.medya.find((m) => m.tur !== 'ses');
    // Video ise bitince geçilir (en fazla 30 sn); uzun notlara daha çok süre
    if (video?.tur !== 'video') zamanlayici.current = setTimeout(sonraki, ani.not.length > 140 ? SURE_MS + 4000 : SURE_MS);
    else zamanlayici.current = setTimeout(sonraki, 30000);
  }

  useEffect(() => {
    sonraki();
    const yokla = setInterval(async () => {
      try {
        const r = await fetch(`/api/anilar?sonra=${enYeni.current}&limit=30`, { cache: 'no-store' });
        const l: Ani[] = (await r.json()).anilar;
        if (!l.length) return;
        enYeni.current = Math.max(enYeni.current, ...l.map((a) => a.id));
        l.forEach((a) => yeniler.current.add(a.id));
        kuyruk.current.splice(sira.current, 0, ...l.reverse()); // sıradaki slaytlar olsun
        setSayi((n) => n + l.length);
      } catch { /* bağlantı yoksa mevcut kuyrukla devam */ }
    }, YOKLAMA_MS);
    const s = setInterval(() => setSaat(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })), 1000);
    // Ekran kararmasın (destekleyen tarayıcılarda)
    let kilit: WakeLockSentinel | null = null;
    navigator.wakeLock?.request('screen').then((k) => { kilit = k; }).catch(() => {});
    return () => { clearInterval(yokla); clearInterval(s); clearTimeout(zamanlayici.current); kilit?.release().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tamEkran() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const sahne = (s: { ani: Ani; anahtar: number; yeni: boolean }, cikiyor: boolean) => {
    const g = s.ani.medya.find((m) => m.tur === 'foto') ?? s.ani.medya.find((m) => m.tur === 'video');
    const yazi = s.ani.not || (s.ani.medya.some((m) => m.tur === 'ses') ? '🎙️ Bir sesli not bırakıldı' : '');
    const imza = `${s.ani.isim ? `— ${s.ani.isim}` : '— bir misafir'} · ${goreliZaman(s.ani.tarih)}`;
    return (
      <div key={s.anahtar} className={`slayt-kart ${cikiyor ? 'cikis' : 'giris'}`}>
        {g?.tur === 'foto' && <div className="slayt-bg" style={{ backgroundImage: `url("${g.url}")` }} />}
        {g?.tur === 'video' && g.onizleme && <div className="slayt-bg" style={{ backgroundImage: `url("${g.onizleme}")` }} />}
        {g ? (
          <figure className="slayt-polaroid">
            {s.yeni && <span className="slayt-yeni">Yeni</span>}
            {g.tur === 'foto'
              ? <img src={g.url} alt="" />
              : <video src={g.url} poster={g.onizleme || undefined} muted autoPlay playsInline onEnded={cikiyor ? undefined : sonraki} onError={cikiyor ? undefined : sonraki} />}
            <figcaption>{yazi && <p>{yazi}</p>}<span>{imza}</span></figcaption>
          </figure>
        ) : (
          <div className="slayt-not">
            {s.yeni && <span className="slayt-yeni">Yeni</span>}
            <p>{yazi}</p><span>{imza}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="slayt" onDoubleClick={tamEkran}>
      {onceki && sahne(onceki, true)}
      {simdiki && sahne(simdiki, false)}
      {!simdiki && !kuyruk.current.length && (
        <div className="slayt-bos"><h1>Anı Duvarı</h1><p>İlk anıyı sen bırak: köşedeki kodu okut.</p></div>
      )}
      <div className="slayt-ust">
        <span className="slayt-marka">{mekan} · Anı Duvarı</span>
        <span className="slayt-saat" suppressHydrationWarning>{saat}</span>
      </div>
      <aside className="slayt-qr">
        <div className="qr-kutu" dangerouslySetInnerHTML={{ __html: qr }} />
        <div>
          <b>Sen de anını bırak</b>
          <span>Kameranla okut, fotoğrafını paylaş</span>
          <small>{sayi} anı duvarda</small>
        </div>
      </aside>
      <button className="slayt-tam" onClick={tamEkran} aria-label="Tam ekran">⛶</button>
    </div>
  );
}
