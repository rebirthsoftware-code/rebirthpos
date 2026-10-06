'use client';
import { useEffect, useRef, useState } from 'react';

const MAKS_SANIYE = 180;

export interface SesKaydi { blob: Blob; mime: string; sure: number; url: string }

/** Mikrofonla kayıt: canlı ses dalgası, süre sayacı, dinle / sil */
export default function SesKaydedici({ kayit, degisti, hata }: {
  kayit: SesKaydi | null;
  degisti: (k: SesKaydi | null) => void;
  hata: (m: string) => void;
}) {
  const [durum, setDurum] = useState<'bos' | 'kayit'>('bos');
  const [sure, setSure] = useState(0);
  const tuval = useRef<HTMLCanvasElement>(null);
  const kaydedici = useRef<MediaRecorder | null>(null);
  const temizle = useRef<() => void>(() => {});

  useEffect(() => () => temizle.current(), []);

  async function basla() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return hata('Bu tarayıcı ses kaydını desteklemiyor.');
    }
    let akis: MediaStream;
    try {
      akis = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      return hata('Mikrofona izin verilmedi. Tarayıcı ayarlarından mikrofon iznini açabilirsin.');
    }
    const tip = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t));
    const r = new MediaRecorder(akis, tip ? { mimeType: tip } : undefined);
    const parcalar: Blob[] = [];
    const baslangic = Date.now();

    // Canlı dalga
    const ses = new AudioContext();
    const analiz = ses.createAnalyser();
    analiz.fftSize = 256;
    ses.createMediaStreamSource(akis).connect(analiz);
    const veri = new Uint8Array(analiz.frequencyBinCount);
    let kare = 0;
    const ciz = () => {
      const c = tuval.current;
      if (c) {
        const x = c.getContext('2d')!;
        const w = (c.width = c.clientWidth * devicePixelRatio), h = (c.height = c.clientHeight * devicePixelRatio);
        analiz.getByteFrequencyData(veri);
        x.clearRect(0, 0, w, h);
        const cubuk = 28, bosluk = w / cubuk;
        x.fillStyle = getComputedStyle(c).color;
        for (let i = 0; i < cubuk; i++) {
          const v = veri[Math.floor((i / cubuk) * veri.length * 0.7)] / 255;
          const ch = Math.max(h * 0.08, v * h * 0.95);
          x.beginPath();
          x.roundRect(i * bosluk + bosluk * 0.25, (h - ch) / 2, bosluk * 0.5, ch, bosluk * 0.25);
          x.fill();
        }
      }
      setSure(Math.floor((Date.now() - baslangic) / 1000));
      kare = requestAnimationFrame(ciz);
    };
    kare = requestAnimationFrame(ciz);
    const sinir = setTimeout(() => r.state === 'recording' && r.stop(), MAKS_SANIYE * 1000);

    temizle.current = () => {
      cancelAnimationFrame(kare);
      clearTimeout(sinir);
      akis.getTracks().forEach((t) => t.stop());
      ses.close().catch(() => {});
    };
    r.ondataavailable = (e) => e.data.size && parcalar.push(e.data);
    r.onstop = () => {
      temizle.current();
      const mime = (r.mimeType || 'audio/webm').split(';')[0];
      const blob = new Blob(parcalar, { type: mime });
      degisti({ blob, mime, sure: (Date.now() - baslangic) / 1000, url: URL.createObjectURL(blob) });
      setDurum('bos');
    };
    r.start(250);
    kaydedici.current = r;
    setSure(0);
    setDurum('kayit');
  }

  const dk = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  if (kayit) {
    return (
      <div className="ses-hazir">
        <audio src={kayit.url} controls preload="metadata" />
        <button type="button" className="metin-btn" onClick={() => { URL.revokeObjectURL(kayit.url); degisti(null); }}>Sil</button>
      </div>
    );
  }
  if (durum === 'kayit') {
    return (
      <div className="ses-kayit">
        <span className="kayit-nokta" aria-hidden="true" />
        <canvas ref={tuval} className="ses-dalga" aria-hidden="true" />
        <span className="sure">{dk(sure)}</span>
        <button type="button" className="ses-btn dur" onClick={() => kaydedici.current?.stop()}>Bitir</button>
      </div>
    );
  }
  return (
    <div className="ses">
      <button type="button" className="ses-btn" onClick={basla}>
        <span className="nokta" /> Kayda Başla
      </button>
      <p className="ipucu">Bir dilek, bir teşekkür ya da sadece &quot;merhaba&quot;… (en fazla 3 dakika)</p>
    </div>
  );
}
