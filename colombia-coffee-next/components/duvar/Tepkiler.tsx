'use client';
import { useState } from 'react';

const EMOJILER = ['☕', '🌿', '❤️', '😍'];

/** Emoji tepkileri — iyimser güncelleme; aynı emojiye tekrar basmak geri alır */
export default function Tepkiler({ id, tepkiler, benim, koyu = false }: {
  id: number; tepkiler: Record<string, number>; benim: string[]; koyu?: boolean;
}) {
  const [sayac, setSayac] = useState(tepkiler);
  const [secili, setSecili] = useState(benim);
  const [atim, setAtim] = useState('');

  async function bas(emoji: string) {
    const vardi = secili.includes(emoji);
    setSecili((s) => (vardi ? s.filter((x) => x !== emoji) : [...s, emoji]));
    setSayac((s) => ({ ...s, [emoji]: Math.max(0, (s[emoji] ?? 0) + (vardi ? -1 : 1)) }));
    if (!vardi) { setAtim(emoji); setTimeout(() => setAtim(''), 450); }
    try {
      const r = await fetch(`/api/anilar/${id}/tepki`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) });
      if (r.ok) {
        const j = await r.json();
        setSayac(j.tepkiler);
        setSecili(j.benim);
      }
    } catch { /* çevrimdışı: iyimser değer kalsın */ }
  }

  return (
    <div className={`tepkiler ${koyu ? 'koyu' : ''}`}>
      {EMOJILER.map((e) => (
        <button
          key={e}
          type="button"
          className={`tepki ${secili.includes(e) ? 'secili' : ''} ${atim === e ? 'atim' : ''}`}
          onClick={() => bas(e)}
          aria-pressed={secili.includes(e)}
          aria-label={`${e} tepkisi`}
        >
          <span>{e}</span>{sayac[e] ? <b>{sayac[e]}</b> : null}
        </button>
      ))}
    </div>
  );
}
