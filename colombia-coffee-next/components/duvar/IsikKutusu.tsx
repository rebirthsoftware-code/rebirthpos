'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Ani } from '@/lib/tipler';
import Tepkiler from './Tepkiler';

/** Tam ekran görüntüleyici: ok tuşları, kaydırma, alttan küçük resimler, tepkiler */
export default function IsikKutusu({ ani, baslangic, kapat }: { ani: Ani; baslangic: number; kapat: () => void }) {
  const gorsel = ani.medya.filter((m) => m.tur !== 'ses');
  const [sira, setSira] = useState(baslangic);
  const dokunX = useRef<number | null>(null);
  const git = useCallback((d: number) => setSira((s) => (s + d + gorsel.length) % gorsel.length), [gorsel.length]);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.key === 'Escape') kapat();
      if (e.key === 'ArrowLeft') git(-1);
      if (e.key === 'ArrowRight') git(1);
    };
    document.addEventListener('keydown', tus);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', tus); document.body.style.overflow = ''; };
  }, [git, kapat]);

  const m = gorsel[sira];
  if (!m) return null;
  return (
    <div
      className="isik-kutusu" role="dialog" aria-modal="true" aria-label="Anı"
      onClick={(e) => e.target === e.currentTarget && kapat()}
      onTouchStart={(e) => { dokunX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        if (dokunX.current === null) return;
        const fark = e.changedTouches[0].clientX - dokunX.current;
        if (Math.abs(fark) > 50) git(fark > 0 ? -1 : 1);
        dokunX.current = null;
      }}
    >
      <button className="ik-kapat" onClick={kapat} aria-label="Kapat">×</button>
      {gorsel.length > 1 && <>
        <button className="ik-ok sol" onClick={() => git(-1)} aria-label="Önceki">‹</button>
        <button className="ik-ok sag" onClick={() => git(1)} aria-label="Sonraki">›</button>
      </>}
      <figure>
        {m.tur === 'foto'
          ? <img key={m.url} src={m.url} alt="" />
          : <video key={m.url} src={m.url} poster={m.onizleme || undefined} controls autoPlay playsInline />}
        <figcaption>
          {ani.not && <span className="ik-not">{ani.not}</span>}
          <span className="ik-kim">{ani.isim ? `— ${ani.isim}` : '— bir misafir'}{gorsel.length > 1 ? ` · ${sira + 1}/${gorsel.length}` : ''}</span>
          <Tepkiler id={ani.id} tepkiler={ani.tepkiler} benim={ani.benim} koyu />
        </figcaption>
        {gorsel.length > 1 && (
          <div className="ik-kucukler">
            {gorsel.map((g, i) => (
              <button key={i} className={i === sira ? 'secili' : ''} onClick={() => setSira(i)} aria-label={`${i + 1}. görsel`}>
                <img src={g.onizleme || g.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </figure>
    </div>
  );
}
