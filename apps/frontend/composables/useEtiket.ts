import { useLocalStorage } from '@vueuse/core';
import { barkodSvg } from '~/utils/barkod';
import { paraFormat } from '~/utils/format';

export interface EtiketUrun {
  id: string;
  ad: string;
  fiyat: string | number;
  barkod?: string | null;
  stok?: string | number;
  stokBirim?: string;
  stokTakibi?: boolean;
}

export interface EtiketAyar {
  mod: 'rulo' | 'a4';
  gen: number; // mm
  yuk: number; // mm
  sutun: number;
  bosluk: number;
  kenar: number;
  adGoster: boolean;
  fiyatGoster: boolean;
  kodGoster: boolean;
}

const VARSAYILAN: EtiketAyar = {
  mod: 'rulo', gen: 50, yuk: 30, sutun: 4, bosluk: 2, kenar: 8,
  adGoster: true, fiyatGoster: true, kodGoster: true,
};

const kac = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

/**
 * Barkod etiketi kuyruğu (şube bazlı, tarayıcıda saklanır) + yazdırma.
 * Ürünler / Stok ekranlarından kuyruğa eklenir, /etiket sayfasından basılır.
 */
export function useEtiket() {
  const sube = useSubeStore();
  const kuyruklar = useLocalStorage<Record<string, Array<{ urun: EtiketUrun; adet: number }>>>('rebirth-etiket-kuyruk', {});
  const ayar = useLocalStorage<EtiketAyar>('rebirth-etiket-ayar', { ...VARSAYILAN }, { mergeDefaults: true });

  const kuyruk = computed({
    get: () => kuyruklar.value[sube.aktifSubeId || ''] || [],
    set: (v) => { kuyruklar.value = { ...kuyruklar.value, [sube.aktifSubeId || '']: v }; },
  });

  function ekle(urun: EtiketUrun, adet = 1) {
    if (!urun.barkod) {
      useToastStore().hata(`"${urun.ad}" ürününün barkodu yok — önce ürüne barkod verin`);
      return false;
    }
    const liste = [...kuyruk.value];
    const var_ = liste.find((k) => k.urun.id === urun.id);
    const sade: EtiketUrun = { id: urun.id, ad: urun.ad, fiyat: urun.fiyat, barkod: urun.barkod, stok: urun.stok, stokBirim: urun.stokBirim, stokTakibi: urun.stokTakibi };
    if (var_) { var_.adet += adet; var_.urun = sade; } else liste.push({ urun: sade, adet });
    kuyruk.value = liste;
    return true;
  }

  function etiketHtml(u: EtiketUrun, a: EtiketAyar = ayar.value) {
    const adPt = Math.max(6, Math.min(11, a.yuk * 0.28));
    const fiyatPt = Math.max(8, Math.min(20, a.yuk * 0.5));
    let svg = '';
    try { svg = barkodSvg(u.barkod || '', { yaziGoster: a.kodGoster }); } catch (e: any) { svg = `<small>${kac(e.message)}</small>`; }
    return `<div class="etiket" style="width:${a.gen}mm;height:${a.yuk}mm">
      ${a.adGoster ? `<div class="e-ad" style="font-size:${adPt}pt">${kac(u.ad)}</div>` : ''}
      <div class="e-barkod">${svg}</div>
      ${a.fiyatGoster ? `<div class="e-fiyat" style="font-size:${fiyatPt}pt">${kac(paraFormat(u.fiyat))}</div>` : ''}
    </div>`;
  }

  // Önizleme ve yazdırmada ortak etiket stili
  const etiketCss = `
    .etiket{background:#fff;color:#000;overflow:hidden;display:flex;flex-direction:column;align-items:center;justify-content:space-between;
      padding:1.2mm 1.5mm;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    .etiket .e-ad{font-weight:700;text-align:center;line-height:1.1;overflow:hidden;width:100%;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
    .etiket .e-barkod{flex:1;width:100%;display:flex;align-items:center;justify-content:center;min-height:0}
    .etiket .e-barkod svg{width:100%;height:100%}
    .etiket .e-fiyat{font-weight:800;line-height:1}`;

  function yazdir() {
    if (!import.meta.client) return;
    const liste = kuyruk.value.filter((k) => k.adet > 0 && k.urun.barkod);
    if (!liste.length) return useToastStore().hata('Yazdırılacak etiket yok');
    const a = ayar.value;
    const hepsi = liste.flatMap((k) => Array.from({ length: k.adet }, () => etiketHtml(k.urun, a))).join('');
    const sayfa = a.mod === 'rulo'
      ? `@page{size:${a.gen}mm ${a.yuk}mm;margin:0} .etiket+.etiket{break-before:page;page-break-before:always}`
      : `@page{size:A4;margin:${a.kenar}mm} .izgara{display:grid;grid-template-columns:repeat(${a.sutun},${a.gen}mm);gap:${a.bosluk}mm} .etiket{break-inside:avoid}`;
    const w = window.open('', '_blank', 'width=720,height=640');
    if (!w) return useToastStore().hata('Yazdırma penceresi açılamadı (pop-up engeli?)');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Barkod Etiketleri</title>
      <style>*{box-sizing:border-box} body{margin:0} ${etiketCss} ${sayfa}</style></head><body>
      ${a.mod === 'a4' ? `<div class="izgara">${hepsi}</div>` : hepsi}
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
      </body></html>`);
    w.document.close();
  }

  return { kuyruk, ayar, ekle, etiketHtml, etiketCss, yazdir };
}
