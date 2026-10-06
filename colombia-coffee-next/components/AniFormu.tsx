'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import SesKaydedici, { type SesKaydi } from './SesKaydedici';
import Fincan from './Fincan';
import { dosyaGonder, fotoHazirla, sadeMime, videoKapak, type Depolama } from '@/lib/istemci/yukleyici';
import type { YuklenenMedya } from '@/lib/tipler';

interface Sinir { fotoMb: number; videoMb: number; sesMb: number; dosya: number; not: number; isim: number }
interface Oge {
  id: string;
  dosya: File;
  tur: 'foto' | 'video';
  url: string;
  durum: 'bekliyor' | 'hazirlaniyor' | 'yukleniyor' | 'tamam';
  yuzde: number;
}

const kimlik = () => Math.random().toString(36).slice(2);

export default function AniFormu({ depolama, sinir, onayli }: { depolama: Depolama; sinir: Sinir; onayli: boolean }) {
  const [ogeler, setOgeler] = useState<Oge[]>([]);
  const [ses, setSes] = useState<SesKaydi | null>(null);
  const [not, setNot] = useState('');
  const [isim, setIsim] = useState('');
  const [tuzak, setTuzak] = useState('');
  const [hata, setHata] = useState('');
  const [asama, setAsama] = useState<'form' | 'gonderiliyor' | 'basarili'>('form');
  const [ilerleme, setIlerleme] = useState(0);
  const [adim, setAdim] = useState('');
  const [sonuc, setSonuc] = useState<{ id: number; durum: string } | null>(null);
  const [surukleniyor, setSurukleniyor] = useState(false);
  const iptal = useRef<AbortController | null>(null);
  const hataZamani = useRef<ReturnType<typeof setTimeout>>(undefined);

  // İsim tarayıcıda hatırlansın (bir sonraki anıda tekrar yazmasın)
  useEffect(() => { try { setIsim(localStorage.getItem('cc_isim') || ''); } catch { /* */ } }, []);

  function hataGoster(m: string) {
    setHata(m);
    clearTimeout(hataZamani.current);
    hataZamani.current = setTimeout(() => setHata(''), 8000);
  }

  function ekle(dosyalar: FileList | File[]) {
    const yeni: Oge[] = [];
    for (const f of Array.from(dosyalar)) {
      const tur = f.type.startsWith('video/') || /\.(mov|qt|mp4|m4v|webm|3gp)$/i.test(f.name) ? 'video' : f.type.startsWith('image/') ? 'foto' : null;
      if (!tur) { hataGoster(`"${f.name}" fotoğraf ya da video değil.`); continue; }
      const mb = tur === 'foto' ? sinir.fotoMb : sinir.videoMb;
      if (f.size > mb * 1024 * 1024) { hataGoster(`"${f.name}" ${mb} MB'tan büyük.`); continue; }
      yeni.push({ id: kimlik(), dosya: f, tur, url: URL.createObjectURL(f), durum: 'bekliyor', yuzde: 0 });
    }
    setOgeler((o) => {
      const birlesik = [...o, ...yeni];
      if (birlesik.length + (ses ? 1 : 0) > sinir.dosya) {
        hataGoster(`Bir seferde en fazla ${sinir.dosya} dosya gönderebilirsin.`);
        yeni.slice(sinir.dosya - o.length - (ses ? 1 : 0)).forEach((x) => URL.revokeObjectURL(x.url));
        return birlesik.slice(0, sinir.dosya - (ses ? 1 : 0));
      }
      return birlesik;
    });
  }

  function cikar(id: string) {
    setOgeler((o) => {
      const x = o.find((y) => y.id === id);
      if (x) URL.revokeObjectURL(x.url);
      return o.filter((y) => y.id !== id);
    });
  }

  const guncelle = (id: string, d: Partial<Oge>) => setOgeler((o) => o.map((x) => (x.id === id ? { ...x, ...d } : x)));

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!ogeler.length && !ses && !not.trim()) return hataGoster('Paylaşmak için bir fotoğraf, video, ses kaydı ya da not ekle.');
    try { localStorage.setItem('cc_isim', isim.trim()); } catch { /* */ }

    const kontrol = new AbortController();
    iptal.current = kontrol;
    setAsama('gonderiliyor');
    setIlerleme(0);
    try {
      // 1) Hazırla: fotoğrafları küçült, video kapaklarını çıkar
      setAdim('Hazırlanıyor…');
      type Parca = { blob: Blob; tur: 'foto' | 'video' | 'ses'; mime: string; ogeId?: string };
      const plan: Array<{ medya: Omit<YuklenenMedya, 'url' | 'onizleme'>; ana: Parca; kucuk?: Parca }> = [];
      for (const o of ogeler) {
        guncelle(o.id, { durum: 'hazirlaniyor' });
        if (o.tur === 'foto') {
          const f = await fotoHazirla(o.dosya);
          plan.push({
            medya: { tur: 'foto', mime: f.mime, g: f.g, y: f.y },
            ana: { blob: f.ana, tur: 'foto', mime: f.mime, ogeId: o.id },
            kucuk: f.kucuk !== f.ana ? { blob: f.kucuk, tur: 'foto', mime: 'image/jpeg', ogeId: o.id } : undefined,
          });
        } else {
          const v = await videoKapak(o.dosya);
          const mime = sadeMime(o.dosya, 'video');
          plan.push({
            medya: { tur: 'video', mime, g: v.g, y: v.y, sure: v.sure },
            ana: { blob: o.dosya, tur: 'video', mime, ogeId: o.id },
            kucuk: v.kapak ? { blob: v.kapak, tur: 'foto', mime: 'image/jpeg', ogeId: o.id } : undefined,
          });
        }
        if (kontrol.signal.aborted) throw new DOMException('İptal', 'AbortError');
      }
      if (ses) plan.push({ medya: { tur: 'ses', mime: ses.mime, sure: ses.sure }, ana: { blob: ses.blob, tur: 'ses', mime: ses.mime } });

      // 2) Yükle — toplam bayta göre tek ilerleme çubuğu, öğe başına yüzde
      const toplam = plan.reduce((t, p) => t + p.ana.blob.size + (p.kucuk?.blob.size ?? 0), 0) || 1;
      let biten = 0;
      const ogeToplam = new Map<string, { bitti: number; boyut: number }>();
      for (const p of plan) if (p.ana.ogeId) ogeToplam.set(p.ana.ogeId, { bitti: 0, boyut: p.ana.blob.size + (p.kucuk?.blob.size ?? 0) });
      const yukle = async (parca: Parca) => {
        const url = await dosyaGonder(parca.blob, parca.tur, parca.mime, depolama, (n) => {
          setIlerleme(Math.min(0.97, (biten + n) / toplam));
          if (parca.ogeId) {
            const t = ogeToplam.get(parca.ogeId)!;
            guncelle(parca.ogeId, { durum: 'yukleniyor', yuzde: Math.round(((t.bitti + n) / t.boyut) * 100) });
          }
        }, kontrol.signal);
        biten += parca.blob.size;
        if (parca.ogeId) ogeToplam.get(parca.ogeId)!.bitti += parca.blob.size;
        return url;
      };
      const medya: YuklenenMedya[] = [];
      for (const [i, p] of plan.entries()) {
        setAdim(plan.length > 1 ? `Yükleniyor ${i + 1}/${plan.length}` : 'Yükleniyor…');
        const kucukUrl = p.kucuk ? await yukle(p.kucuk) : '';
        const anaUrl = await yukle(p.ana);
        medya.push({ ...p.medya, url: anaUrl, onizleme: kucukUrl });
        if (p.ana.ogeId) guncelle(p.ana.ogeId, { durum: 'tamam', yuzde: 100 });
      }

      // 3) Kaydet
      setAdim('Duvara asılıyor…');
      const r = await fetch('/api/anilar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isim: isim.trim(), not: not.trim(), medya, web_sitesi: tuzak }),
        signal: kontrol.signal,
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.hata || 'Kaydedilemedi, tekrar dene.');
      setIlerleme(1);
      setSonuc({ id: j.id, durum: j.durum });
      setAsama('basarili');
      ogeler.forEach((o) => URL.revokeObjectURL(o.url));
      setOgeler([]); setSes(null); setNot('');
    } catch (err) {
      setAsama('form');
      setOgeler((o) => o.map((x) => ({ ...x, durum: 'bekliyor', yuzde: 0 })));
      if ((err as Error).name !== 'AbortError') hataGoster((err as Error).message || 'Bir şeyler ters gitti, tekrar dene.');
    }
  }

  const bosMu = !ogeler.length && !ses && !not.trim();

  return (
    <>
      <form className="form" onSubmit={gonder} noValidate>
        <section
          className={`kart medya-kart ${surukleniyor ? 'surukleniyor' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setSurukleniyor(true); }}
          onDragLeave={() => setSurukleniyor(false)}
          onDrop={(e) => { e.preventDefault(); setSurukleniyor(false); ekle(e.dataTransfer.files); }}
        >
          <h2>Fotoğraf &amp; Video</h2>
          <div className="secim-izgara">
            <label className="secim">
              <input type="file" accept="image/*" capture="environment" onChange={(e) => { ekle(e.target.files!); e.target.value = ''; }} />
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3l2-2h6l2 2h3v12H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
              <b>Fotoğraf çek</b>
            </label>
            <label className="secim">
              <input type="file" accept="image/*,video/*,.mov,.qt" multiple onChange={(e) => { ekle(e.target.files!); e.target.value = ''; }} />
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></svg>
              <b>Galeriden seç</b>
            </label>
            <label className="secim">
              <input type="file" accept="video/*" capture="environment" onChange={(e) => { ekle(e.target.files!); e.target.value = ''; }} />
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3z" /></svg>
              <b>Video çek</b>
            </label>
          </div>
          <p className="ipucu">Birden fazla seçebilirsin · bilgisayardan sürükleyip bırakabilirsin</p>
          {ogeler.length > 0 && (
            <ul className="secilenler">
              {ogeler.map((o) => (
                <li key={o.id} className={`secilen ${o.durum}`}>
                  {o.tur === 'foto'
                    ? <img src={o.url} alt="" />
                    : <video src={o.url} muted playsInline preload="metadata" />}
                  {o.tur === 'video' && <span className="secilen-rozet">▶</span>}
                  {o.durum === 'yukleniyor' && <span className="secilen-yuzde" style={{ '--y': o.yuzde } as React.CSSProperties}>{o.yuzde}%</span>}
                  {o.durum === 'tamam' && <span className="secilen-tamam">✓</span>}
                  {asama === 'form' && <button type="button" className="secilen-sil" aria-label="Kaldır" onClick={() => cikar(o.id)}>×</button>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="kart">
          <h2>Sesli Not</h2>
          <SesKaydedici kayit={ses} degisti={setSes} hata={hataGoster} />
        </section>

        <section className="kart kagit">
          <h2>Not</h2>
          <textarea value={not} onChange={(e) => setNot(e.target.value)} maxLength={sinir.not} rows={4} placeholder="Bugün burada…" />
          <div className="sayac">{not.length}/{sinir.not}</div>
        </section>

        <section className="kart">
          <h2>İsmin</h2>
          <input type="text" value={isim} onChange={(e) => setIsim(e.target.value)} maxLength={sinir.isim} placeholder="Adını yazabilirsin (isteğe bağlı)" autoComplete="name" />
          <input type="text" className="tuzak" tabIndex={-1} autoComplete="off" aria-hidden="true" value={tuzak} onChange={(e) => setTuzak(e.target.value)} />
        </section>

        {hata && <p className="hata-kutu" role="alert">{hata}</p>}
        <button type="submit" className="gonder" disabled={asama !== 'form' || bosMu}>Anımı Duvara As</button>
        <p className="kucuk-yazi ortala">
          Gönderdiğin anı {onayli ? 'onaylandıktan sonra' : 'hemen'} Anı Duvarı&apos;nda herkese açık olarak görünür.
          Fotoğraflardaki konum bilgisi cihazından çıkmadan silinir.
        </p>
      </form>

      {asama === 'gonderiliyor' && (
        <div className="perde" role="dialog" aria-live="polite">
          <div className="perde-ic">
            <Fincan oran={ilerleme} />
            <div className="yuzde">%{Math.round(ilerleme * 100)}</div>
            <p>{adim}<br /><small>Anın demleniyor, lütfen sayfayı kapatma</small></p>
            <button type="button" className="metin-btn acik" onClick={() => iptal.current?.abort()}>İptal et</button>
          </div>
        </div>
      )}

      {asama === 'basarili' && sonuc && (
        <div className="perde" role="dialog">
          <div className="dokulen-yapraklar" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>
          <div className="perde-ic">
            <div className="tamam-ikon">🌿</div>
            <h2>{sonuc.durum === 'yayinda' ? 'Anın duvara asıldı!' : 'Anın bize ulaştı!'}</h2>
            <p>{sonuc.durum === 'yayinda'
              ? 'Paylaştığın için teşekkürler. Artık Anı Duvarı\'nda herkes görebilir.'
              : 'Onaylandıktan sonra Anı Duvarı\'nda görünecek. Teşekkürler!'}</p>
            <div className="perde-butonlar">
              <Link className="gonder" href={sonuc.durum === 'yayinda' ? `/duvar?yeni=${sonuc.id}` : '/duvar'}>Anı Duvarına Git</Link>
              <button type="button" className="metin-btn acik" onClick={() => { setAsama('form'); setSonuc(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                Bir anı daha bırak
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
