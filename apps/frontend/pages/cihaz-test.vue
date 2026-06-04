<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

type TestMod = 'AUTO' | 'BASARI' | 'HATA';

interface CihazDurum {
  kart: { marka: string; testMod: TestMod; gecikmeMs: number; logSayisi: number };
  okc: { marka: string; testMod: TestMod; gecikmeMs: number; logSayisi: number };
}

interface KartLog {
  zaman: string;
  islem: 'CEK' | 'IADE';
  basarili: boolean;
  tutar: number;
  slipNo?: string;
  rrn?: string;
  banka?: string;
  sonRakam?: string;
  onayKod?: string;
  referans?: string;
  sureMs: number;
  hata?: string;
}

interface OkcKdvSatiri { oran: number; matrah: number; kdv: number; }
interface OkcOdeme { tip: string; tutar: number; }

interface OkcLog {
  zaman: string;
  basarili: boolean;
  fisNo?: string;
  adisyonNo: string;
  toplamTutar: number;
  araToplam?: number;
  iskontoTutar?: number;
  kdvBandSayisi: number;
  kdvDokumu: OkcKdvSatiri[];
  odemeler: OkcOdeme[];
  kalemSayisi: number;
  sureMs: number;
  hata?: string;
}

interface UyumKarsilastirma {
  sistem: { fisSayisi: number; toplam: number; nakit: number; kart: number };
  okc: { fisSayisi: number; toplam: number; nakit: number; kart: number; kdvBantlari: { oran: number; kdv: number }[] };
  uyum: { fisSayisi: boolean; toplam: boolean; nakit: boolean; kart: boolean; tumu: boolean };
}

interface RaporKdv { oran: number; matrah: number; kdv: number }
interface RaporOdeme { tip: string; tutar: number; fisSayisi: number }
interface OkcRapor {
  raporTipi: 'X' | 'Z';
  marka: string;
  uretildiTarih: string;
  baslama: string | null;
  bitis: string;
  zNo?: number;
  fisSayisi: number;
  hataliFisSayisi: number;
  toplamSatis: number;
  araToplam: number;
  toplamKdv: number;
  toplamIskonto: number;
  toplamIade: number;
  kdvBantlari: RaporKdv[];
  odemeler: RaporOdeme[];
}

const durum = ref<CihazDurum | null>(null);
const kartLog = ref<KartLog[]>([]);
const okcLog = ref<OkcLog[]>([]);
const aktifRapor = ref<OkcRapor | null>(null);
const uyum = ref<UyumKarsilastirma | null>(null);
const toast = useToastStore();
const aktifSekme = ref<'kart' | 'okc'>('kart');
const acikSatir = ref<string | null>(null);

const sonKartIslem = computed<KartLog | null>(() => kartLog.value[0] || null);
const sonOkcIslem = computed<OkcLog | null>(() => okcLog.value[0] || null);

// Son işlem ID — animasyon trigger için
const sonKartId = ref<string>('');
const sonOkcId = ref<string>('');

async function yukle() {
  try {
    const [d, k, o, u] = await Promise.all([
      apiFetch<CihazDurum>('/cihaz-test/durum'),
      apiFetch<KartLog[]>('/cihaz-test/log/kart'),
      apiFetch<OkcLog[]>('/cihaz-test/log/okc'),
      apiFetch<UyumKarsilastirma>('/cihaz-test/karsilastirma'),
    ]);
    durum.value = d;
    if (k[0] && k[0].zaman !== sonKartId.value) sonKartId.value = k[0].zaman;
    if (o[0] && o[0].zaman !== sonOkcId.value) sonOkcId.value = o[0].zaman;
    kartLog.value = k;
    okcLog.value = o;
    uyum.value = u;
  } catch (e: any) {
    // Sessizce yut — polling devam etsin
  }
}

async function tamReset() {
  if (!confirm(
    'TAM SIFIRLAMA\n\n' +
    'Bu işlem GERİ ALINAMAZ:\n' +
    '• Tüm açık/kapalı adisyonlar IPTAL olur\n' +
    '• Tüm ödemeler iptal işaretlenir\n' +
    '• Tüm masalar boşaltılır\n' +
    '• Mock cihaz log + sayaçlar sıfırlanır\n\n' +
    'Test için temiz başlangıç istiyorsanız devam edin. Devam edilsin mi?'
  )) return;
  try {
    const sonuc = await apiFetch<{ adisyonIptal: number; odemeIptal: number; masaSerbest: number }>(
      '/cihaz-test/tam-reset',
      { method: 'POST' },
    );
    await yukle();
    toast.basari(
      `Sıfırlandı · ${sonuc.adisyonIptal} adisyon · ${sonuc.odemeIptal} ödeme · ${sonuc.masaSerbest} masa`,
    );
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Reset başarısız');
  }
}

let timer: any;
onMounted(() => {
  yukle();
  timer = setInterval(yukle, 1500);
});
onUnmounted(() => clearInterval(timer));

// ── Ayar fonksiyonları ──
async function kartTestMod(mod: TestMod) {
  await apiFetch('/cihaz-test/kart/ayar', { method: 'POST', body: { testMod: mod } });
  await yukle();
}
async function okcTestMod(mod: TestMod) {
  await apiFetch('/cihaz-test/okc/ayar', { method: 'POST', body: { testMod: mod } });
  await yukle();
}
async function kartGecikme(ms: number) {
  await apiFetch('/cihaz-test/kart/ayar', { method: 'POST', body: { gecikmeMs: ms } });
  await yukle();
}
async function okcGecikme(ms: number) {
  await apiFetch('/cihaz-test/okc/ayar', { method: 'POST', body: { gecikmeMs: ms } });
  await yukle();
}
async function logTemizle() {
  await apiFetch('/cihaz-test/log/temizle', { method: 'POST' });
  await yukle();
  toast.basari('Loglar temizlendi');
}

function sanalCihazAc() {
  if (!import.meta.client) return;
  window.open(
    window.location.origin + '/sanal-cihaz',
    'rebirth-sanal-cihaz',
    'width=480,height=820,menubar=no,toolbar=no,location=no,status=no',
  );
}

// ── Manuel test ──
// Türkiye restoran/cafe standardı: hem yemek hem içecek %10 → her zaman 1 bant.
// %1 (gıda market) ve %20 (alkol) burada geçerli değil.
const manTutar = ref(100);
const manOdemeTip = ref<'NAKIT' | 'KREDI_KARTI' | 'KARMA'>('NAKIT');
const yapiyor = ref<'kart' | 'okc' | 'stres' | ''>('');

function odemeBolme(tip: string, toplam: number): OkcOdeme[] {
  if (tip === 'KARMA') return [{ tip: 'NAKIT', tutar: toplam / 2 }, { tip: 'KREDI_KARTI', tutar: toplam / 2 }];
  return [{ tip, tutar: toplam }];
}

async function manuelKartCek() {
  if (yapiyor.value) return;
  yapiyor.value = 'kart';
  try {
    await apiFetch('/cihaz-test/sentetik/kart', {
      method: 'POST',
      body: { tutar: manTutar.value, referans: 'MANUEL-TEST' },
    });
    await yukle();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Kart çekimi başarısız');
  } finally {
    yapiyor.value = '';
  }
}

async function manuelOkcFis() {
  if (yapiyor.value) return;
  yapiyor.value = 'okc';
  try {
    await apiFetch('/cihaz-test/sentetik/okc', {
      method: 'POST',
      body: {
        toplamTutar: manTutar.value,
        kdvOranlari: [10],
        odemeler: odemeBolme(manOdemeTip.value, manTutar.value),
      },
    });
    await yukle();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'ÖKC fişi başarısız');
  } finally {
    yapiyor.value = '';
  }
}

// ── GİB Raporları (Z = mali kapanış, X = ara) ──
async function xRaporuAl() {
  if (yapiyor.value) return;
  yapiyor.value = 'rapor' as any;
  try {
    aktifRapor.value = await apiFetch<OkcRapor>('/okc/x-raporu');
    toast.basari('X raporu üretildi');
  } catch (e: any) {
    toast.hata(e?.data?.message || 'X raporu alınamadı');
  } finally {
    yapiyor.value = '';
  }
}
async function zRaporuAl() {
  if (yapiyor.value) return;
  if (!confirm('Z RAPORU MALİ KAPANIŞ\n\nGünlük kapanış raporu çekiyorsunuz. Sayaçlar artırılacak, sonraki rapor yeni dönemi gösterecek. Devam edilsin mi?')) return;
  yapiyor.value = 'rapor' as any;
  try {
    aktifRapor.value = await apiFetch<OkcRapor>('/okc/z-raporu', { method: 'POST' });
    toast.basari(`Z raporu #${aktifRapor.value.zNo} üretildi`);
    await yukle();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Z raporu alınamadı');
  } finally {
    yapiyor.value = '';
  }
}

function raporYazdir() {
  if (import.meta.client) window.print();
}

const stresAdet = ref(10);
async function stresTest() {
  if (yapiyor.value) return;
  yapiyor.value = 'stres';
  try {
    const sonuc = await apiFetch<{ sureMs: number; sayi: number }>('/cihaz-test/stres-test', {
      method: 'POST',
      body: { sayi: stresAdet.value, hedef: 'HER_IKISI' },
    });
    await yukle();
    toast.basari(`${sonuc.sayi}×2 işlem · ${sonuc.sureMs}ms`);
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Stres testi başarısız');
  } finally {
    yapiyor.value = '';
  }
}

// ── Metrikler ──
const kartMetrik = computed(() => {
  const total = kartLog.value.length;
  const basarili = kartLog.value.filter((l) => l.basarili).length;
  const ortSure = total ? Math.round(kartLog.value.reduce((s, l) => s + (l.sureMs || 0), 0) / total) : 0;
  return { total, basarili, basarisiz: total - basarili, oran: total ? Math.round((basarili * 100) / total) : 0, ortSure };
});
const okcMetrik = computed(() => {
  const total = okcLog.value.length;
  const basarili = okcLog.value.filter((l) => l.basarili).length;
  const ortSure = total ? Math.round(okcLog.value.reduce((s, l) => s + (l.sureMs || 0), 0) / total) : 0;
  return { total, basarili, basarisiz: total - basarili, oran: total ? Math.round((basarili * 100) / total) : 0, ortSure };
});

// ── Cihaz LCD durumları ──
function lcdYas(iso: string): number {
  return Date.now() - new Date(iso).getTime();
}

// Saniyede bir refresh için reactive saat — SSR'da setInterval çalıştırma
const simdi = ref(Date.now());
let simdiTimer: any;
onMounted(() => {
  simdiTimer = setInterval(() => { simdi.value = Date.now(); }, 1000);
});
onUnmounted(() => clearInterval(simdiTimer));

const kartLcd = computed(() => {
  const k = sonKartIslem.value;
  if (!k) return { satir1: 'HAZIR', satir2: 'Kart bekleniyor', renk: 'idle' as const };
  const yas = simdi.value - new Date(k.zaman).getTime();
  if (yas > 8000) return { satir1: 'HAZIR', satir2: 'Kart bekleniyor', renk: 'idle' as const };
  if (!k.basarili) return { satir1: 'REDDEDILDI', satir2: k.hata || '—', renk: 'red' as const };
  return { satir1: 'ONAYLANDI', satir2: `${paraFormat(k.tutar)} · ${k.banka || ''}`, renk: 'success' as const };
});
const okcLcd = computed(() => {
  const o = sonOkcIslem.value;
  if (!o) return { satir1: 'HAZIR', satir2: 'Mali fiş bekleniyor', renk: 'idle' as const };
  const yas = simdi.value - new Date(o.zaman).getTime();
  if (yas > 8000) return { satir1: 'HAZIR', satir2: 'Mali fiş bekleniyor', renk: 'idle' as const };
  if (!o.basarili) return { satir1: 'HATA', satir2: o.hata || '—', renk: 'red' as const };
  return { satir1: 'FIS KESILDI', satir2: o.fisNo || '', renk: 'success' as const };
});

function zamanFmt(iso: string) {
  return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
function tipEtiket(tip: string): string {
  if (tip === 'NAKIT') return 'Nakit';
  if (tip === 'KREDI_KARTI') return 'Kart';
  if (tip === 'TICKET') return 'Yemek Çeki';
  return tip;
}

const modlar: { kod: TestMod; ad: string; ikon: string }[] = [
  { kod: 'AUTO', ad: 'Otomatik', ikon: 'fa-shuffle' },
  { kod: 'BASARI', ad: 'Hep Onay', ikon: 'fa-check' },
  { kod: 'HATA', ad: 'Hep Red', ikon: 'fa-xmark' },
];
</script>

<template>
  <div class="-mx-4 sm:-mx-5 lg:-mx-6 -my-4 sm:-my-5 lg:-my-6 flex flex-col min-h-[calc(100vh-65px)]">
    <!-- Üst başlık + metrikler -->
    <header class="px-5 sm:px-6 py-3 border-b border-pearl-10 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
      <div>
        <div class="text-[10px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-0.5 flex items-center gap-2">
          <span class="status-dot-gold" />
          MOCK MOD · Geliştirici Test Paneli
        </div>
        <h1 class="text-lg sm:text-xl font-light text-pearl tracking-tight">
          Cihaz Test Paneli
        </h1>
      </div>

      <!-- Metrikler -->
      <div class="flex items-center gap-4 sm:gap-6 text-xs">
        <div class="text-center">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-0.5">Kart</div>
          <div class="flex items-center gap-2 tabular">
            <span class="text-pearl font-semibold">{{ kartMetrik.total }}</span>
            <span class="text-emerald-600">✓{{ kartMetrik.basarili }}</span>
            <span class="text-red-600">✗{{ kartMetrik.basarisiz }}</span>
            <span class="text-pearl-50">·</span>
            <span class="text-pearl-70">{{ kartMetrik.oran }}%</span>
            <span class="text-pearl-50">·</span>
            <span class="text-pearl-70">{{ kartMetrik.ortSure }}ms</span>
          </div>
        </div>
        <div class="w-px h-8 bg-pearl-10" />
        <div class="text-center">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-0.5">ÖKC</div>
          <div class="flex items-center gap-2 tabular">
            <span class="text-pearl font-semibold">{{ okcMetrik.total }}</span>
            <span class="text-emerald-600">✓{{ okcMetrik.basarili }}</span>
            <span class="text-red-600">✗{{ okcMetrik.basarisiz }}</span>
            <span class="text-pearl-50">·</span>
            <span class="text-pearl-70">{{ okcMetrik.oran }}%</span>
            <span class="text-pearl-50">·</span>
            <span class="text-pearl-70">{{ okcMetrik.ortSure }}ms</span>
          </div>
        </div>
        <div class="w-px h-8 bg-pearl-10" />
        <button
          @click="sanalCihazAc"
          class="px-3 py-1.5 rounded-lg bg-gold-soft border border-gold-primary/30 text-gold-dark hover:bg-gold-primary/15 transition text-xs font-medium flex items-center gap-1.5"
        >
          <i class="fas fa-display" />Sanal Cihaz
          <i class="fas fa-up-right-from-square text-[9px] opacity-60" />
        </button>
        <button
          @click="logTemizle"
          class="px-3 py-1.5 rounded-lg bg-pearl-5 border border-pearl-20 text-pearl-70 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-600 transition text-xs font-medium"
        >
          <i class="fas fa-trash mr-1.5" />Log Temizle
        </button>
        <button
          @click="tamReset"
          class="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-700 hover:bg-red-500/20 transition text-xs font-semibold"
          title="Tüm DB adisyonları + ödemeleri iptal et, masaları boşalt, mock cihaz sıfırla"
        >
          <i class="fas fa-rotate-left mr-1.5" />Tam Reset
        </button>
      </div>
    </header>

    <!-- UYUM KARŞILAŞTIRMA — Sistem (DB) vs ÖKC (Mock cihaz) -->
    <div
      v-if="uyum"
      class="px-5 sm:px-6 py-3 border-b border-pearl-10 bg-pearl-5"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <i :class="['fas', uyum.uyum.tumu ? 'fa-circle-check text-emerald-600' : 'fa-triangle-exclamation text-amber-600']" />
          <span class="text-xs font-semibold uppercase tracking-extra-wide text-pearl">
            Sistem ↔ ÖKC Uyum Kontrolü (Bugün)
          </span>
        </div>
        <span
          :class="[
            'badge !text-[10px] tabular',
            uyum.uyum.tumu ? 'badge-success' : 'badge-warning'
          ]"
        >
          {{ uyum.uyum.tumu ? 'TAM UYUM' : 'UYUMSUZLUK' }}
        </span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div :class="['rounded-lg p-2.5 border', uyum.uyum.fisSayisi ? 'bg-white border-pearl-10' : 'bg-red-50 border-red-300']">
          <div class="text-[10px] uppercase text-pearl-50 font-semibold mb-1">Fiş Sayısı</div>
          <div class="flex items-center justify-between tabular">
            <span class="text-pearl-70">Sistem: <b class="text-pearl">{{ uyum.sistem.fisSayisi }}</b></span>
            <span class="text-pearl-70">ÖKC: <b class="text-pearl">{{ uyum.okc.fisSayisi }}</b></span>
          </div>
        </div>
        <div :class="['rounded-lg p-2.5 border', uyum.uyum.toplam ? 'bg-white border-pearl-10' : 'bg-red-50 border-red-300']">
          <div class="text-[10px] uppercase text-pearl-50 font-semibold mb-1">Toplam</div>
          <div class="flex items-center justify-between tabular">
            <span class="text-pearl-70">S: <b class="text-pearl">{{ paraFormat(uyum.sistem.toplam) }}</b></span>
            <span class="text-pearl-70">Ö: <b class="text-pearl">{{ paraFormat(uyum.okc.toplam) }}</b></span>
          </div>
        </div>
        <div :class="['rounded-lg p-2.5 border', uyum.uyum.nakit ? 'bg-white border-pearl-10' : 'bg-red-50 border-red-300']">
          <div class="text-[10px] uppercase text-pearl-50 font-semibold mb-1 flex items-center gap-1">
            <i class="fas fa-money-bill-wave text-emerald-600 text-[9px]" />Nakit
          </div>
          <div class="flex items-center justify-between tabular">
            <span class="text-pearl-70">S: <b class="text-pearl">{{ paraFormat(uyum.sistem.nakit) }}</b></span>
            <span class="text-pearl-70">Ö: <b class="text-pearl">{{ paraFormat(uyum.okc.nakit) }}</b></span>
          </div>
        </div>
        <div :class="['rounded-lg p-2.5 border', uyum.uyum.kart ? 'bg-white border-pearl-10' : 'bg-red-50 border-red-300']">
          <div class="text-[10px] uppercase text-pearl-50 font-semibold mb-1 flex items-center gap-1">
            <i class="fas fa-credit-card text-blue-600 text-[9px]" />Kart
          </div>
          <div class="flex items-center justify-between tabular">
            <span class="text-pearl-70">S: <b class="text-pearl">{{ paraFormat(uyum.sistem.kart) }}</b></span>
            <span class="text-pearl-70">Ö: <b class="text-pearl">{{ paraFormat(uyum.okc.kart) }}</b></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Ana layout: 2 cihaz (sol) · loglar (orta) · kontrol+manuel test (sağ) -->
    <div class="flex-1 grid grid-cols-1 xl:grid-cols-[380px_1fr_320px] gap-4 p-4 sm:p-5 min-h-0">
      <!-- ◇ SOL: İKİ SANAL CİHAZ -->
      <aside class="flex flex-col gap-4 min-h-0 overflow-y-auto">
        <!-- KART POS CİHAZI -->
        <div class="surface-elevated overflow-hidden">
          <div class="bg-gradient-to-br from-ink-300 via-ink-200 to-ink-300 p-4 relative border-b-2 border-pearl-20">
            <div class="text-center text-[10px] uppercase tracking-extra-wide text-pearl-60 font-bold mb-2">
              <i class="fas fa-credit-card mr-1.5" />KART POS · MOCK
            </div>
            <!-- LCD -->
            <div
              :class="[
                'rounded-xl px-3 py-3 mb-3 text-center font-mono shadow-inner border-2 transition-all duration-300',
                kartLcd.renk === 'idle' && 'bg-amber-50 border-gold-primary/40 text-gold-dark',
                kartLcd.renk === 'success' && 'bg-emerald-50 border-emerald-500/60 text-emerald-700 animate-pulse-gold',
                kartLcd.renk === 'red' && 'bg-red-50 border-red-500/60 text-red-700',
              ]"
            >
              <div class="text-base font-bold tracking-wider mb-0.5">{{ kartLcd.satir1 }}</div>
              <div class="text-[11px] opacity-80 break-all">{{ kartLcd.satir2 }}</div>
            </div>
            <!-- Kart slotu -->
            <div class="h-2 bg-ink-400 rounded mb-2 mx-4 shadow-inner" />
            <!-- Tuşlar (sadeleştirilmiş) -->
            <div class="grid grid-cols-3 gap-1 text-[10px]">
              <div v-for="t in ['1','2','3','4','5','6','7','8','9','*','0','#']" :key="t"
                class="bg-white border border-pearl-20 rounded py-1 text-center text-pearl-70 font-mono">{{ t }}</div>
            </div>
          </div>
          <!-- Kart kontrol -->
          <div class="p-3">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-2 font-semibold flex items-center justify-between">
              <span>Test Modu</span>
              <span class="text-pearl-70">Gecikme: <span class="tabular text-gold-dark">{{ durum?.kart.gecikmeMs ?? 0 }}ms</span></span>
            </div>
            <div class="grid grid-cols-3 gap-1 mb-2">
              <button
                v-for="m in modlar"
                :key="m.kod"
                @click="kartTestMod(m.kod)"
                :class="[
                  'p-1.5 rounded-md border-2 transition text-center text-[10px] font-medium no-tap-highlight',
                  durum?.kart.testMod === m.kod
                    ? m.kod === 'BASARI' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700'
                      : m.kod === 'HATA' ? 'bg-red-500/10 border-red-500/50 text-red-600'
                        : 'bg-gold-soft border-gold-primary/40 text-gold-dark'
                    : 'border-pearl-10 text-pearl-60 hover:border-pearl-30',
                ]"
              >
                <i :class="['fas', m.ikon, 'mr-1']" />{{ m.ad }}
              </button>
            </div>
            <div class="grid grid-cols-4 gap-1">
              <button v-for="g in [0, 500, 1200, 3000]" :key="g"
                @click="kartGecikme(g)"
                :class="['py-1 rounded text-[10px] font-medium border transition tabular', durum?.kart.gecikmeMs === g ? 'bg-gold-soft border-gold-primary/40 text-gold-dark' : 'border-pearl-10 text-pearl-60']"
              >{{ g }}ms</button>
            </div>
          </div>
        </div>

        <!-- ÖKC YAZARKASA -->
        <div class="surface-elevated overflow-hidden">
          <div class="bg-gradient-to-br from-ink-300 via-ink-200 to-ink-300 p-4 relative border-b-2 border-pearl-20">
            <div class="text-center text-[10px] uppercase tracking-extra-wide text-pearl-60 font-bold mb-2">
              <i class="fas fa-receipt mr-1.5" />ÖKC YAZARKASA · MOCK
            </div>
            <!-- LCD -->
            <div
              :class="[
                'rounded-xl px-3 py-3 mb-3 text-center font-mono shadow-inner border-2 transition-all duration-300',
                okcLcd.renk === 'idle' && 'bg-amber-50 border-gold-primary/40 text-gold-dark',
                okcLcd.renk === 'success' && 'bg-emerald-50 border-emerald-500/60 text-emerald-700 animate-pulse-gold',
                okcLcd.renk === 'red' && 'bg-red-50 border-red-500/60 text-red-700',
              ]"
            >
              <div class="text-base font-bold tracking-wider mb-0.5">{{ okcLcd.satir1 }}</div>
              <div class="text-[11px] opacity-80 break-all">{{ okcLcd.satir2 }}</div>
            </div>
            <!-- Termal yazıcı şeridi -->
            <div class="flex items-center gap-2 px-1">
              <div class="text-[9px] text-pearl-60 font-bold">YAZICI</div>
              <div class="flex-1 h-1 bg-ink-400 rounded shadow-inner" />
              <i class="fas fa-print text-pearl-60 text-xs" />
            </div>
          </div>
          <!-- ÖKC kontrol -->
          <div class="p-3">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-2 font-semibold flex items-center justify-between">
              <span>Test Modu</span>
              <span class="text-pearl-70">Gecikme: <span class="tabular text-gold-dark">{{ durum?.okc.gecikmeMs ?? 0 }}ms</span></span>
            </div>
            <div class="grid grid-cols-3 gap-1 mb-2">
              <button
                v-for="m in modlar"
                :key="m.kod"
                @click="okcTestMod(m.kod)"
                :class="[
                  'p-1.5 rounded-md border-2 transition text-center text-[10px] font-medium no-tap-highlight',
                  durum?.okc.testMod === m.kod
                    ? m.kod === 'BASARI' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-700'
                      : m.kod === 'HATA' ? 'bg-red-500/10 border-red-500/50 text-red-600'
                        : 'bg-gold-soft border-gold-primary/40 text-gold-dark'
                    : 'border-pearl-10 text-pearl-60 hover:border-pearl-30',
                ]"
              >
                <i :class="['fas', m.ikon, 'mr-1']" />{{ m.ad }}
              </button>
            </div>
            <div class="grid grid-cols-4 gap-1">
              <button v-for="g in [0, 150, 500, 1500]" :key="g"
                @click="okcGecikme(g)"
                :class="['py-1 rounded text-[10px] font-medium border transition tabular', durum?.okc.gecikmeMs === g ? 'bg-gold-soft border-gold-primary/40 text-gold-dark' : 'border-pearl-10 text-pearl-60']"
              >{{ g }}ms</button>
            </div>
          </div>
        </div>
      </aside>

      <!-- ◇ ORTA: LOG TABLOLARI (sekmeli) -->
      <main class="flex flex-col gap-3 min-h-0">
        <!-- Sekme başlıkları -->
        <div class="flex items-center gap-1 shrink-0">
          <button
            @click="aktifSekme = 'kart'"
            :class="['flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition', aktifSekme === 'kart' ? 'bg-white text-pearl border-gold-primary' : 'text-pearl-60 border-transparent hover:text-pearl']"
          >
            <i class="fas fa-credit-card" />Kart İşlemleri
            <span class="badge-gold !text-[9px] !py-0.5 !px-1.5 tabular">{{ kartLog.length }}</span>
          </button>
          <button
            @click="aktifSekme = 'okc'"
            :class="['flex items-center gap-2 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition', aktifSekme === 'okc' ? 'bg-white text-pearl border-gold-primary' : 'text-pearl-60 border-transparent hover:text-pearl']"
          >
            <i class="fas fa-receipt" />ÖKC Fişleri
            <span class="badge-gold !text-[9px] !py-0.5 !px-1.5 tabular">{{ okcLog.length }}</span>
          </button>
          <div class="ml-auto text-[10px] text-pearl-50 flex items-center gap-1.5">
            <span class="status-dot-gold" />Canlı (1.5sn)
          </div>
        </div>

        <!-- KART LOG TABLOSU -->
        <div v-if="aktifSekme === 'kart'" class="surface-elevated flex-1 min-h-0 flex flex-col overflow-hidden">
          <div v-if="!kartLog.length" class="flex-1 flex items-center justify-center text-pearl-50 text-sm">
            <div class="text-center">
              <i class="fas fa-inbox text-3xl text-pearl-40 mb-2 block" />
              Kart işlemi yok — sağdaki paneli kullanarak test edin
            </div>
          </div>
          <div v-else class="flex-1 min-h-0 overflow-y-auto">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-white z-10">
                <tr class="text-[10px] uppercase tracking-wider text-pearl-50 border-b border-pearl-10">
                  <th class="text-left py-2.5 px-3 font-semibold">Saat</th>
                  <th class="text-left py-2.5 px-3 font-semibold">İşlem</th>
                  <th class="text-right py-2.5 px-3 font-semibold">Tutar</th>
                  <th class="text-left py-2.5 px-3 font-semibold">Banka · Kart</th>
                  <th class="text-left py-2.5 px-3 font-semibold">Slip / RRN</th>
                  <th class="text-right py-2.5 px-3 font-semibold">Süre</th>
                  <th class="text-center py-2.5 px-3 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(l, i) in kartLog"
                  :key="i"
                  class="border-b border-pearl-5 hover:bg-pearl-5 transition"
                >
                  <td class="py-2 px-3 text-pearl-70 tabular">{{ zamanFmt(l.zaman) }}</td>
                  <td class="py-2 px-3">
                    <span :class="['badge !text-[9px] !py-0.5', l.islem === 'CEK' ? 'badge-gold' : 'badge-info']">
                      {{ l.islem === 'CEK' ? 'Çekim' : 'İade' }}
                    </span>
                  </td>
                  <td class="py-2 px-3 text-right font-bold tabular">{{ paraFormat(l.tutar) }}</td>
                  <td class="py-2 px-3 text-pearl-70">
                    <template v-if="l.banka">{{ l.banka }} · <span class="font-mono">•••• {{ l.sonRakam }}</span></template>
                    <span v-else class="text-pearl-40">—</span>
                  </td>
                  <td class="py-2 px-3 font-mono text-[11px]">
                    <template v-if="l.slipNo">
                      <div class="text-gold-dark">{{ l.slipNo }}</div>
                      <div v-if="l.rrn" class="text-pearl-50 text-[10px]">RRN {{ l.rrn }}</div>
                    </template>
                    <span v-else-if="l.hata" class="text-red-600">{{ l.hata }}</span>
                  </td>
                  <td class="py-2 px-3 text-right text-pearl-60 tabular">{{ l.sureMs }}ms</td>
                  <td class="py-2 px-3 text-center">
                    <i :class="['fas', l.basarili ? 'fa-check-circle text-emerald-600' : 'fa-times-circle text-red-600']" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ÖKC LOG TABLOSU -->
        <div v-if="aktifSekme === 'okc'" class="surface-elevated flex-1 min-h-0 flex flex-col overflow-hidden">
          <div v-if="!okcLog.length" class="flex-1 flex items-center justify-center text-pearl-50 text-sm">
            <div class="text-center">
              <i class="fas fa-inbox text-3xl text-pearl-40 mb-2 block" />
              ÖKC fişi yok — manuel test veya ödeme alımı yapın
            </div>
          </div>
          <div v-else class="flex-1 min-h-0 overflow-y-auto">
            <table class="w-full text-xs">
              <thead class="sticky top-0 bg-white z-10">
                <tr class="text-[10px] uppercase tracking-wider text-pearl-50 border-b border-pearl-10">
                  <th class="w-8 py-2.5 px-2"></th>
                  <th class="text-left py-2.5 px-3 font-semibold">Saat</th>
                  <th class="text-left py-2.5 px-3 font-semibold">Fiş No</th>
                  <th class="text-left py-2.5 px-3 font-semibold">Adisyon</th>
                  <th class="text-right py-2.5 px-3 font-semibold">Toplam</th>
                  <th class="text-left py-2.5 px-3 font-semibold">Ödeme</th>
                  <th class="text-left py-2.5 px-3 font-semibold">KDV</th>
                  <th class="text-right py-2.5 px-3 font-semibold">Süre</th>
                  <th class="text-center py-2.5 px-3 font-semibold">Durum</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="(l, i) in okcLog" :key="i">
                  <tr
                    @click="acikSatir = acikSatir === ('o' + i) ? null : ('o' + i)"
                    class="border-b border-pearl-5 hover:bg-pearl-5 transition cursor-pointer"
                  >
                    <td class="py-2 px-2 text-center text-pearl-50">
                      <i :class="['fas text-[10px] transition', acikSatir === ('o' + i) ? 'fa-chevron-down' : 'fa-chevron-right']" />
                    </td>
                    <td class="py-2 px-3 text-pearl-70 tabular">{{ zamanFmt(l.zaman) }}</td>
                    <td class="py-2 px-3 font-mono text-[11px] text-gold-dark">{{ l.fisNo || '—' }}</td>
                    <td class="py-2 px-3 font-mono text-pearl-70 text-[11px]">{{ l.adisyonNo }}</td>
                    <td class="py-2 px-3 text-right font-bold tabular">{{ paraFormat(l.toplamTutar) }}</td>
                    <td class="py-2 px-3">
                      <div class="flex flex-wrap gap-1">
                        <span v-for="(o, j) in l.odemeler" :key="j"
                          :class="['badge !text-[9px] !py-0.5', o.tip === 'NAKIT' ? 'badge-success' : o.tip === 'KREDI_KARTI' ? 'badge-info' : 'badge-warning']"
                        >
                          {{ tipEtiket(o.tip) }} <span class="tabular">{{ paraFormat(o.tutar) }}</span>
                        </span>
                      </div>
                    </td>
                    <td class="py-2 px-3 text-pearl-70 text-[11px] tabular">
                      <span class="font-semibold">{{ l.kdvBandSayisi }}</span> bant ·
                      <span v-for="(d, k) in l.kdvDokumu" :key="k" class="text-pearl-60">
                        %{{ d.oran }}{{ k < l.kdvDokumu.length - 1 ? ', ' : '' }}
                      </span>
                    </td>
                    <td class="py-2 px-3 text-right text-pearl-60 tabular">{{ l.sureMs }}ms</td>
                    <td class="py-2 px-3 text-center">
                      <i :class="['fas', l.basarili ? 'fa-check-circle text-emerald-600' : 'fa-times-circle text-red-600']"
                        :title="l.hata || ''" />
                    </td>
                  </tr>
                  <tr v-if="acikSatir === ('o' + i)" :key="i + '-detay'" class="bg-pearl-5 border-b border-pearl-10">
                    <td colspan="9" class="px-6 py-4">
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <!-- KDV detay -->
                        <div>
                          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">KDV Dökümü</div>
                          <table class="w-full text-xs">
                            <thead>
                              <tr class="text-[10px] text-pearl-50 border-b border-pearl-10">
                                <th class="text-left py-1 font-semibold">Oran</th>
                                <th class="text-right py-1 font-semibold">Matrah</th>
                                <th class="text-right py-1 font-semibold">KDV</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr v-for="(d, k) in l.kdvDokumu" :key="k" class="border-b border-pearl-5">
                                <td class="py-1 text-pearl-80">%{{ d.oran }}</td>
                                <td class="py-1 text-right tabular text-pearl">{{ paraFormat(d.matrah) }}</td>
                                <td class="py-1 text-right tabular text-gold-dark">{{ paraFormat(d.kdv) }}</td>
                              </tr>
                              <tr class="font-semibold">
                                <td class="py-1 text-pearl">Toplam</td>
                                <td class="py-1 text-right tabular">{{ paraFormat(l.araToplam || 0) }}</td>
                                <td class="py-1 text-right tabular text-gold-dark">
                                  {{ paraFormat(l.kdvDokumu.reduce((s, d) => s + d.kdv, 0)) }}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <!-- Ödeme detay -->
                        <div>
                          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Ödeme Dağılımı</div>
                          <table class="w-full text-xs">
                            <tbody>
                              <tr v-for="(o, j) in l.odemeler" :key="j" class="border-b border-pearl-5">
                                <td class="py-1 text-pearl-80">
                                  <i :class="['fas mr-1', o.tip === 'NAKIT' ? 'fa-money-bill-wave text-emerald-600' : o.tip === 'KREDI_KARTI' ? 'fa-credit-card text-blue-600' : 'fa-ticket text-amber-600']" />
                                  {{ tipEtiket(o.tip) }}
                                </td>
                                <td class="py-1 text-right tabular font-semibold">{{ paraFormat(o.tutar) }}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                        <!-- Diğer info -->
                        <div class="text-xs space-y-1.5">
                          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Diğer</div>
                          <div class="flex justify-between"><span class="text-pearl-60">Kalem sayısı</span><span class="tabular text-pearl">{{ l.kalemSayisi }}</span></div>
                          <div v-if="l.iskontoTutar" class="flex justify-between"><span class="text-pearl-60">İskonto</span><span class="tabular text-amber-700">{{ paraFormat(l.iskontoTutar) }}</span></div>
                          <div class="flex justify-between"><span class="text-pearl-60">İşlem süresi</span><span class="tabular text-pearl">{{ l.sureMs }}ms</span></div>
                          <div v-if="l.hata" class="text-red-600 mt-2">{{ l.hata }}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <!-- ◇ SAĞ: MANUEL TEST + STRES TEST -->
      <aside class="flex flex-col gap-4 min-h-0 overflow-y-auto">
        <!-- Manuel test -->
        <div class="surface-elevated p-4">
          <div class="section-title !mb-3 flex items-center gap-2">
            <i class="fas fa-flask text-gold-primary text-xs" />
            Manuel Sentetik Test
          </div>

          <label class="block text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">Tutar (₺)</label>
          <input v-model.number="manTutar" type="number" min="1" max="100000" step="0.5" class="input-base !py-2 text-base font-bold tabular mb-3" />

          <div class="grid grid-cols-4 gap-1 mb-3">
            <button v-for="t in [50, 100, 250, 1000]" :key="t" @click="manTutar = t"
              class="py-1.5 rounded-md bg-pearl-5 border border-pearl-10 text-pearl-70 hover:bg-gold-soft hover:border-gold-primary/30 hover:text-gold-dark text-[11px] tabular transition"
            >₺{{ t }}</button>
          </div>

          <div class="bg-pearl-5 border border-pearl-10 rounded-lg px-3 py-2 mb-3 text-[11px] flex items-center gap-2">
            <i class="fas fa-percent text-gold-primary text-[10px]" />
            <span class="text-pearl-70">KDV: <b class="text-pearl">%10</b> (yemek + içecek standart)</span>
          </div>

          <label class="block text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">Ödeme Tipi</label>
          <select v-model="manOdemeTip" class="input-base !py-2 text-sm mb-4">
            <option value="NAKIT">Nakit</option>
            <option value="KREDI_KARTI">Kredi Kartı</option>
            <option value="KARMA">Karma (yarı nakit + yarı kart)</option>
          </select>

          <div class="grid grid-cols-2 gap-2">
            <button
              @click="manuelKartCek"
              :disabled="!!yapiyor"
              class="px-3 py-2.5 rounded-xl border-2 border-gold-primary/40 bg-gold-soft text-gold-dark hover:bg-gold-primary/20 transition text-xs font-semibold disabled:opacity-50"
            >
              <i :class="['fas', yapiyor === 'kart' ? 'fa-spinner fa-spin' : 'fa-credit-card', 'mr-1.5']" />Kart Çek
            </button>
            <button
              @click="manuelOkcFis"
              :disabled="!!yapiyor"
              class="btn-gold !py-2.5 !text-xs !rounded-xl"
            >
              <i :class="['fas mr-1.5', yapiyor === 'okc' ? 'fa-spinner fa-spin' : 'fa-receipt']" />Fiş Kes
            </button>
          </div>
        </div>

        <!-- GİB RAPORLARI -->
        <div class="surface-elevated p-4">
          <div class="section-title !mb-3 flex items-center gap-2">
            <i class="fas fa-file-invoice text-gold-primary text-xs" />
            GİB Raporları
          </div>
          <div class="grid grid-cols-2 gap-2 mb-2">
            <button
              @click="xRaporuAl"
              :disabled="!!yapiyor"
              class="px-3 py-2.5 rounded-xl border-2 border-gold-primary/40 bg-gold-soft text-gold-dark hover:bg-gold-primary/20 transition text-xs font-semibold disabled:opacity-50"
            >
              <i class="fas fa-magnifying-glass mr-1.5" />X Raporu
              <div class="text-[9px] font-normal text-pearl-60 mt-0.5">Ara rapor</div>
            </button>
            <button
              @click="zRaporuAl"
              :disabled="!!yapiyor"
              class="px-3 py-2.5 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 transition text-xs font-semibold disabled:opacity-50"
            >
              <i class="fas fa-lock mr-1.5" />Z Raporu
              <div class="text-[9px] font-normal text-pearl-60 mt-0.5">Mali kapanış</div>
            </button>
          </div>
          <p class="text-[10px] text-pearl-50 leading-relaxed">
            <b>X:</b> sayaçları sıfırlamadan günü görüntüler. <b>Z:</b> günlük mali kapanış (Türkiye'de günde 1× zorunlu) — sonraki Z yeni dönemi sayar.
          </p>
        </div>

        <!-- Stres test -->
        <div class="surface-elevated p-4">
          <div class="section-title !mb-3 flex items-center gap-2">
            <i class="fas fa-bolt text-gold-primary text-xs" />
            Stres Testi
          </div>
          <label class="block text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">İşlem Sayısı</label>
          <div class="grid grid-cols-4 gap-1 mb-3">
            <button v-for="n in [5, 10, 25, 50]" :key="n" @click="stresAdet = n"
              :class="['py-1.5 rounded-md border text-[11px] tabular transition', stresAdet === n ? 'bg-gold-soft border-gold-primary/40 text-gold-dark' : 'bg-pearl-5 border-pearl-10 text-pearl-70']"
            >{{ n }}×</button>
          </div>
          <button
            @click="stresTest"
            :disabled="!!yapiyor"
            class="w-full px-3 py-3 rounded-xl border-2 border-red-500/40 bg-red-500/10 text-red-700 hover:bg-red-500/15 transition text-xs font-semibold disabled:opacity-50"
          >
            <i :class="['fas mr-1.5', yapiyor === 'stres' ? 'fa-spinner fa-spin' : 'fa-rocket']" />
            {{ stresAdet }}× Kart + {{ stresAdet }}× ÖKC
          </button>
          <p class="text-[10px] text-pearl-50 mt-2 leading-relaxed">
            Paralel sentetik işlemler — hata yolu, gecikme ve KDV bandı çeşitliliğini test eder. DB'ye yazılmaz.
          </p>
        </div>

        <!-- Yönergeler -->
        <div class="surface-elevated p-4 text-[11px] text-pearl-70 leading-relaxed">
          <div class="section-title !mb-2 flex items-center gap-2">
            <i class="fas fa-circle-info text-gold-primary text-xs" />
            Test Senaryoları
          </div>
          <ol class="list-decimal list-inside space-y-1 text-pearl-60">
            <li><b class="text-pearl">Manuel:</b> tutar+KDV+ödeme seç → "Fiş Kes"</li>
            <li><b class="text-pearl">Çoklu KDV:</b> "YEMEK" veya "KARMA" seç</li>
            <li><b class="text-pearl">Hata akışı:</b> mod="Hep Red" sonra test</li>
            <li><b class="text-pearl">Yavaş cihaz:</b> gecikme=3000ms</li>
            <li><b class="text-pearl">Stres:</b> 50× ile yük altında davranışı gör</li>
            <li><b class="text-pearl">Gerçek akış:</b> /masalar → adisyon → ödeme</li>
          </ol>
        </div>
      </aside>
    </div>

    <!-- ◇ GİB RAPOR MODAL (termal makbuz görseli) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200"
        leave-active-class="transition duration-150"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="aktifRapor"
          class="fixed inset-0 z-[60] bg-pearl-60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto print:bg-white print:p-0"
          @click.self="aktifRapor = null"
        >
          <div class="rapor-yaprak w-full max-w-md my-4 print:my-0 print:max-w-none">
            <!-- Yırtık üst kenar -->
            <div class="rapor-tear rapor-tear-top" />

            <div class="rapor-icerik px-7 py-6 font-mono text-[12px] leading-relaxed text-pearl">
              <!-- Başlık -->
              <div class="text-center mb-4">
                <div class="font-bold text-base mb-1 tracking-wider">REBIRTH POS</div>
                <div class="text-[10px] uppercase tracking-wider text-pearl-60">
                  Mali Yazarkasa · {{ aktifRapor.marka }}
                </div>
                <div class="border-t border-dashed border-pearl-30 my-3" />
                <div class="font-bold text-lg tracking-widest">
                  {{ aktifRapor.raporTipi === 'Z' ? 'Z RAPORU' : 'X RAPORU' }}
                </div>
                <div v-if="aktifRapor.raporTipi === 'Z'" class="text-sm tabular mt-0.5">
                  Mali Kapanış No: <b>{{ String(aktifRapor.zNo).padStart(4, '0') }}</b>
                </div>
                <div class="text-[10px] text-pearl-60 mt-1">
                  {{ new Date(aktifRapor.uretildiTarih).toLocaleString('tr-TR') }}
                </div>
                <div v-if="aktifRapor.baslama" class="text-[10px] text-pearl-60">
                  Dönem: {{ new Date(aktifRapor.baslama).toLocaleString('tr-TR') }} →
                </div>
                <div v-else class="text-[10px] text-pearl-60">
                  Dönem: Sistem başlangıcından itibaren
                </div>
              </div>

              <div class="border-t border-dashed border-pearl-30 my-3" />

              <!-- Genel toplamlar -->
              <div class="space-y-1 mb-3">
                <div class="flex justify-between">
                  <span>Fiş Sayısı</span>
                  <span class="tabular font-bold">{{ aktifRapor.fisSayisi }}</span>
                </div>
                <div v-if="aktifRapor.hataliFisSayisi > 0" class="flex justify-between text-amber-700">
                  <span>Hatalı Fiş</span>
                  <span class="tabular">{{ aktifRapor.hataliFisSayisi }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Ara Toplam</span>
                  <span class="tabular">{{ paraFormat(aktifRapor.araToplam) }}</span>
                </div>
                <div v-if="aktifRapor.toplamIskonto > 0" class="flex justify-between text-amber-700">
                  <span>Toplam İskonto</span>
                  <span class="tabular">− {{ paraFormat(aktifRapor.toplamIskonto) }}</span>
                </div>
                <div class="flex justify-between">
                  <span>Toplam KDV</span>
                  <span class="tabular">{{ paraFormat(aktifRapor.toplamKdv) }}</span>
                </div>
                <div v-if="aktifRapor.toplamIade > 0" class="flex justify-between text-red-700">
                  <span>Toplam İade</span>
                  <span class="tabular">− {{ paraFormat(aktifRapor.toplamIade) }}</span>
                </div>
                <div class="flex justify-between font-bold text-base pt-1 border-t border-dashed border-pearl-30 mt-1">
                  <span>TOPLAM SATIŞ</span>
                  <span class="tabular gold-text">{{ paraFormat(aktifRapor.toplamSatis) }}</span>
                </div>
              </div>

              <div class="border-t border-dashed border-pearl-30 my-3" />

              <!-- KDV Bantları -->
              <div class="mb-3">
                <div class="text-center font-bold mb-2 text-[11px] tracking-wider">KDV BANTLARI</div>
                <div class="space-y-1">
                  <div
                    v-for="b in aktifRapor.kdvBantlari"
                    :key="b.oran"
                    class="space-y-0.5"
                  >
                    <div class="flex justify-between">
                      <span>KDV %{{ b.oran }} Matrah</span>
                      <span class="tabular">{{ paraFormat(b.matrah) }}</span>
                    </div>
                    <div class="flex justify-between pl-3 text-pearl-70">
                      <span>KDV %{{ b.oran }} Vergi</span>
                      <span class="tabular">{{ paraFormat(b.kdv) }}</span>
                    </div>
                  </div>
                  <div v-if="!aktifRapor.kdvBantlari.length" class="text-center text-pearl-50 italic">— Bant yok —</div>
                </div>
              </div>

              <div class="border-t border-dashed border-pearl-30 my-3" />

              <!-- Ödeme Dağılımı -->
              <div class="mb-3">
                <div class="text-center font-bold mb-2 text-[11px] tracking-wider">ÖDEME DAĞILIMI</div>
                <div class="space-y-1">
                  <div
                    v-for="o in aktifRapor.odemeler"
                    :key="o.tip"
                    class="flex justify-between"
                  >
                    <span>{{ tipEtiket(o.tip) }} ({{ o.fisSayisi }} fiş)</span>
                    <span class="tabular">{{ paraFormat(o.tutar) }}</span>
                  </div>
                  <div v-if="!aktifRapor.odemeler.length" class="text-center text-pearl-50 italic">— Ödeme yok —</div>
                </div>
              </div>

              <div class="border-t border-dashed border-pearl-30 my-3" />

              <!-- Mali bölüm -->
              <div class="text-center text-[10px] text-pearl-60 mt-4 space-y-0.5">
                <div>Bu rapor {{ aktifRapor.raporTipi === 'Z' ? 'MALİ KAPANIŞ NİTELİĞİNDEDİR' : 'MALİ NİTELİK TAŞIMAZ' }}</div>
                <div class="mt-2 tracking-widest text-pearl-40">MOCK MOD — TEST</div>
              </div>
            </div>

            <!-- Yırtık alt kenar -->
            <div class="rapor-tear rapor-tear-bottom" />

            <!-- Aksiyon butonları (sadece ekranda) -->
            <div class="px-4 pb-4 pt-3 flex gap-2 print:hidden">
              <button @click="raporYazdir" class="btn-ghost flex-1 !py-2 !text-xs">
                <i class="fas fa-print mr-1.5" />Yazdır
              </button>
              <button @click="aktifRapor = null" class="btn-gold flex-1 !py-2 !text-xs">
                <i class="fas fa-check mr-1.5" />Kapat
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Termal fiş kağıdı görüntüsü */
.rapor-yaprak {
  background: linear-gradient(180deg, #fefefe 0%, #f8f8f5 100%);
  box-shadow:
    0 24px 60px -20px rgba(28, 28, 32, 0.35),
    0 0 0 1px rgba(28, 28, 32, 0.06);
  position: relative;
}
.rapor-icerik {
  position: relative;
}
.rapor-icerik::before,
.rapor-icerik::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(180deg, transparent, rgba(28, 28, 32, 0.05) 10%, rgba(28, 28, 32, 0.05) 90%, transparent);
}
.rapor-icerik::before { left: 16px; }
.rapor-icerik::after { right: 16px; }

/* Yırtık kenarlar — gerçek termal fiş gibi zigzag */
.rapor-tear {
  height: 12px;
  background:
    linear-gradient(135deg, #f8f8f5 25%, transparent 25%) -6px 0,
    linear-gradient(225deg, #f8f8f5 25%, transparent 25%) -6px 0,
    linear-gradient(315deg, #f8f8f5 25%, transparent 25%),
    linear-gradient(45deg, #f8f8f5 25%, transparent 25%);
  background-size: 12px 12px;
  background-color: transparent;
}
.rapor-tear-top {
  transform: rotate(180deg);
  background-color: #fefefe;
}
.rapor-tear-bottom {
  background-color: #f8f8f5;
}

@media print {
  .rapor-yaprak {
    box-shadow: none;
    max-width: 80mm;
  }
}
</style>
