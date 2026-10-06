'use client';
import type { Ani } from '@/lib/tipler';
import SesOynatici from './SesOynatici';
import Tepkiler from './Tepkiler';
import { goreliZaman } from '@/lib/istemci/zaman';

/** Duvardaki tek anı: fotoğraf/video polaroid, ses notu, el yazısı not, tepkiler */
export default function AniKarti({ ani, ac, yeni }: { ani: Ani; ac: (id: number, sira: number) => void; yeni?: boolean }) {
  const gorsel = ani.medya.filter((m) => m.tur !== 'ses');
  const sesler = ani.medya.filter((m) => m.tur === 'ses');
  const ilk = gorsel[0];

  return (
    <article id={`ani-${ani.id}`} className={`ani ${gorsel.length ? '' : 'sadece-not'} ${yeni ? 'yeni-parlak' : ''}`}>
      {ilk && (
        <button type="button" className="kart-medya" onClick={() => ac(ani.id, 0)} aria-label="Büyüt"
          style={ilk.g && ilk.y ? { aspectRatio: `${ilk.g} / ${Math.min(ilk.y, ilk.g * 1.6)}` } : undefined}>
          {ilk.tur === 'foto'
            ? <img src={ilk.onizleme || ilk.url} alt={ani.not ? ani.not.slice(0, 80) : 'Misafir fotoğrafı'} loading="lazy" decoding="async" />
            : ilk.onizleme
              ? <img src={ilk.onizleme} alt="Video kapağı" loading="lazy" decoding="async" />
              : <video src={`${ilk.url}#t=0.1`} muted playsInline preload="metadata" />}
          {ilk.tur === 'video' && <span className="oynat" aria-hidden="true">▶</span>}
          {gorsel.length > 1 && (
            <span className="adet">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="7" width="13" height="13" rx="2" /><path d="M4 16V5a1 1 0 0 1 1-1h11" /></svg>
              {gorsel.length}
            </span>
          )}
        </button>
      )}
      {sesler.map((s, i) => <SesOynatici key={i} url={s.url} sure={s.sure} tohum={ani.id + i} />)}
      {ani.not && <p className="kart-not">{ani.not}</p>}
      <footer>
        <span className="kim">
          {ani.isim ? `— ${ani.isim}` : '— bir misafir'}
          <time dateTime={ani.tarih} suppressHydrationWarning>{goreliZaman(ani.tarih)}</time>
        </span>
      </footer>
      <Tepkiler id={ani.id} tepkiler={ani.tepkiler} benim={ani.benim} />
    </article>
  );
}
