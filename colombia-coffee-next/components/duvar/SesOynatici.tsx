'use client';
import { useEffect, useRef, useState } from 'react';

// Sesli not oynatıcısı: oynat/durdur + kahve çekirdeği dizisi şeklinde ilerleme
const CUBUK = 26;
// Her kayıt için sabit ama farklı görünen "dalga" (id'den türetilir)
const dalga = (tohum: number) => Array.from({ length: CUBUK }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(tohum * 7.13 + i * 1.7) * Math.cos(i * 0.6 + tohum)));

export default function SesOynatici({ url, sure, tohum }: { url: string; sure: number; tohum: number }) {
  const ses = useRef<HTMLAudioElement>(null);
  const [caliyor, setCaliyor] = useState(false);
  const [an, setAn] = useState(0);
  const [toplam, setToplam] = useState(sure || 0);
  const yukseklik = useRef(dalga(tohum));

  useEffect(() => {
    const a = ses.current!;
    const zaman = () => setAn(a.currentTime);
    const bilgi = () => Number.isFinite(a.duration) && setToplam(a.duration);
    const bitti = () => { setCaliyor(false); setAn(0); };
    a.addEventListener('timeupdate', zaman);
    a.addEventListener('loadedmetadata', bilgi);
    a.addEventListener('ended', bitti);
    a.addEventListener('pause', () => setCaliyor(false));
    a.addEventListener('play', () => setCaliyor(true));
    return () => { a.removeEventListener('timeupdate', zaman); a.removeEventListener('loadedmetadata', bilgi); a.removeEventListener('ended', bitti); };
  }, []);

  function degistir() {
    const a = ses.current!;
    if (a.paused) {
      // Aynı anda tek ses çalsın
      document.querySelectorAll('audio').forEach((x) => x !== a && x.pause());
      a.play().catch(() => {});
    } else a.pause();
  }

  function atla(e: React.MouseEvent<HTMLDivElement>) {
    const a = ses.current!;
    if (!toplam) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * toplam;
    if (a.paused) a.play().catch(() => {});
  }

  const oran = toplam ? an / toplam : 0;
  const dk = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  return (
    <div className="ses-oynatici">
      <audio ref={ses} src={url} preload="none" />
      <button type="button" className="ses-oynat" onClick={degistir} aria-label={caliyor ? 'Durdur' : 'Dinle'}>
        {caliyor
          ? <svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
          : <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>}
      </button>
      <div className="ses-cubuklar" onClick={atla} role="slider" aria-label="Konum" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(oran * 100)}>
        {yukseklik.current.map((h, i) => (
          <i key={i} style={{ height: `${h * 100}%` }} className={i / CUBUK < oran ? 'dolu' : ''} />
        ))}
      </div>
      <span className="ses-sure">{dk(caliyor || an ? an : toplam)}</span>
    </div>
  );
}
