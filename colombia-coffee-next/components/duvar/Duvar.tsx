'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Ani } from '@/lib/tipler';
import AniKarti from './AniKarti';
import IsikKutusu from './IsikKutusu';

const FILTRELER = [
  { tur: '', ad: 'Tümü' },
  { tur: 'foto', ad: 'Fotoğraflar' },
  { tur: 'video', ad: 'Videolar' },
  { tur: 'ses', ad: 'Sesli notlar' },
  { tur: 'not', ad: 'Notlar' },
] as const;
const SAYFA = 24;
const YOKLAMA_MS = 10_000;

async function getir(p: Record<string, string | number | undefined>): Promise<Ani[]> {
  const q = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]));
  const r = await fetch(`/api/anilar?${q}`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Anılar alınamadı');
  return (await r.json()).anilar;
}

export default function Duvar({ ilk, yeniId }: { ilk: Ani[]; yeniId?: number }) {
  const [anilar, setAnilar] = useState<Ani[]>(ilk);
  const [tur, setTur] = useState('');
  const [devami, setDevami] = useState(ilk.length === SAYFA);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState('');
  const [bekleyen, setBekleyen] = useState<Ani[]>([]);
  const [acik, setAcik] = useState<{ ani: Ani; sira: number } | null>(null);
  const [parlak, setParlak] = useState<number | undefined>(yeniId);
  const alt = useRef<HTMLDivElement>(null);
  const enYeni = useRef(Math.max(0, ...ilk.map((a) => a.id)));

  // Yeni bırakılan anıya kaydır, kısa süre parlasın
  useEffect(() => {
    if (!yeniId) return;
    document.getElementById(`ani-${yeniId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const t = setTimeout(() => setParlak(undefined), 4000);
    return () => clearTimeout(t);
  }, [yeniId]);

  const filtrele = useCallback(async (yeniTur: string) => {
    setTur(yeniTur);
    setYukleniyor(true);
    setHata('');
    setBekleyen([]);
    try {
      const l = await getir({ tur: yeniTur, limit: SAYFA });
      setAnilar(l);
      setDevami(l.length === SAYFA);
      enYeni.current = Math.max(0, ...l.map((a) => a.id));
    } catch (e) { setHata((e as Error).message); } finally { setYukleniyor(false); }
  }, []);

  const dahaFazla = useCallback(async () => {
    if (yukleniyor || !devami || !anilar.length) return;
    setYukleniyor(true);
    try {
      const l = await getir({ tur, once: anilar[anilar.length - 1].id, limit: SAYFA });
      setAnilar((a) => [...a, ...l.filter((x) => !a.some((y) => y.id === x.id))]);
      setDevami(l.length === SAYFA);
    } catch (e) { setHata((e as Error).message); } finally { setYukleniyor(false); }
  }, [anilar, devami, tur, yukleniyor]);

  // Sonsuz kaydırma
  useEffect(() => {
    const el = alt.current;
    if (!el) return;
    const g = new IntersectionObserver((x) => x[0].isIntersecting && dahaFazla(), { rootMargin: '800px' });
    g.observe(el);
    return () => g.disconnect();
  }, [dahaFazla]);

  // Canlı akış: yeni anılar düzenli olarak kontrol edilir. Sayfa en üstteyse doğrudan eklenir,
  // aşağıdaysa okuyanı kaydırmamak için "N yeni anı" düğmesi çıkar.
  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      try {
        const l = await getir({ tur, sonra: enYeni.current, limit: 30 });
        if (!l.length) return;
        enYeni.current = Math.max(enYeni.current, ...l.map((a) => a.id));
        if (window.scrollY < 300) setAnilar((a) => [...l, ...a]);
        else setBekleyen((b) => [...l, ...b]);
      } catch { /* bağlantı geri gelince devam eder */ }
    }, YOKLAMA_MS);
    return () => clearInterval(t);
  }, [tur]);

  function bekleyenleriGoster() {
    setAnilar((a) => [...bekleyen, ...a]);
    setBekleyen([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const ac = useCallback((id: number, sira: number) => {
    const a = anilar.find((x) => x.id === id);
    if (a) setAcik({ ani: a, sira });
  }, [anilar]);

  return (
    <>
      <div className="filtreler" role="tablist" aria-label="Anı türü">
        {FILTRELER.map((f) => (
          <button key={f.tur} role="tab" aria-selected={tur === f.tur} className={tur === f.tur ? 'aktif' : ''} onClick={() => filtrele(f.tur)}>
            {f.ad}
          </button>
        ))}
      </div>

      {bekleyen.length > 0 && (
        <button className="yeni-var" onClick={bekleyenleriGoster}>↑ {bekleyen.length} yeni anı</button>
      )}

      {anilar.length > 0 ? (
        <div className={`duvar ${yukleniyor && !devami ? 'soluk' : ''}`} aria-live="polite">
          {anilar.map((a) => <AniKarti key={a.id} ani={a} ac={ac} yeni={a.id === parlak} />)}
        </div>
      ) : !yukleniyor && (
        <div className="duvar-bos">
          {tur ? <p>Bu türde henüz anı yok.</p> : <>
            <p>Duvar şimdilik boş.</p>
            <Link className="gonder kucuk" href="/">İlk anıyı sen bırak 🌿</Link>
          </>}
        </div>
      )}

      {hata && <p className="hata-kutu ortala">{hata}</p>}
      <div ref={alt} className="duvar-alt">
        {yukleniyor && <span className="yukleniyor-nokta">Anılar yükleniyor</span>}
        {!devami && anilar.length > SAYFA && <span className="kucuk-yazi">Tüm anılar bu kadar ☕</span>}
      </div>

      {acik && <IsikKutusu ani={acik.ani} baslangic={acik.sira} kapat={() => setAcik(null)} />}
    </>
  );
}
