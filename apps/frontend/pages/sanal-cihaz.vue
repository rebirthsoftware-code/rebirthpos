<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'], layout: false });

// Sanal Beko Yazarkasa-POS Test Cihazı
// Gerçek Beko/Hugin GMP-3 test cihazlarının yaptığını simüle eder:
// - Yeşil mono LCD
// - 4×4 tuş takımı
// - Termal yazıcı (üstte paper-feed animasyonu)
// - LED durum göstergeleri (HAZIR / İŞLEM / HATA)
// - Otomatik POS yazılımıyla senkron — backend log'unu izler

interface OkcLog {
  zaman: string;
  basarili: boolean;
  fisNo?: string;
  adisyonNo: string;
  toplamTutar: number;
  araToplam?: number;
  kdvBandSayisi: number;
  kdvDokumu: { oran: number; matrah: number; kdv: number }[];
  odemeler: { tip: string; tutar: number }[];
  kalemSayisi: number;
  sureMs: number;
  hata?: string;
}

interface KartLog {
  zaman: string;
  islem: 'CEK' | 'IADE';
  basarili: boolean;
  tutar: number;
  slipNo?: string;
  banka?: string;
  sonRakam?: string;
  hata?: string;
}

interface CihazDurum {
  okc: { testMod: string; gecikmeMs: number; logSayisi: number };
  kart: { testMod: string; gecikmeMs: number; logSayisi: number };
}

const okcLog = ref<OkcLog[]>([]);
const kartLog = ref<KartLog[]>([]);
const durum = ref<CihazDurum | null>(null);

const sonOkcZaman = ref('');
const sonKartZaman = ref('');

async function yukle() {
  try {
    const [d, o, k] = await Promise.all([
      apiFetch<CihazDurum>('/cihaz-test/durum'),
      apiFetch<OkcLog[]>('/cihaz-test/log/okc'),
      apiFetch<KartLog[]>('/cihaz-test/log/kart'),
    ]);
    durum.value = d;

    // Yeni fiş tespiti (animasyon trigger)
    if (o[0] && o[0].zaman !== sonOkcZaman.value && sonOkcZaman.value) {
      tetikleYazici();
      tetikleBip();
    }
    if (o[0]) sonOkcZaman.value = o[0].zaman;

    if (k[0] && k[0].zaman !== sonKartZaman.value && sonKartZaman.value) {
      if (k[0].basarili) tetikleBip();
    }
    if (k[0]) sonKartZaman.value = k[0].zaman;

    okcLog.value = o;
    kartLog.value = k;
  } catch {}
}

let timer: any;
onMounted(() => {
  yukle();
  // İlk yüklemede son fişleri "geçmiş" olarak işaretle (yeni sayma)
  setTimeout(() => {
    if (okcLog.value[0]) sonOkcZaman.value = okcLog.value[0].zaman;
    if (kartLog.value[0]) sonKartZaman.value = kartLog.value[0].zaman;
  }, 100);
  timer = setInterval(yukle, 1000);
});
onUnmounted(() => clearInterval(timer));

// ── Saat (LCD üst sağı) ──
const simdi = ref(new Date());
let saatTimer: any;
onMounted(() => {
  saatTimer = setInterval(() => (simdi.value = new Date()), 1000);
});
onUnmounted(() => clearInterval(saatTimer));
const saatStr = computed(() => simdi.value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
const tarihStr = computed(() => simdi.value.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }));

// ── LCD içeriği ──
const sonOkc = computed(() => okcLog.value[0] || null);
const sonKart = computed(() => kartLog.value[0] || null);

// Hangi cihaz son aktif: ÖKC veya KART
const aktif = computed<'okc' | 'kart' | 'idle'>(() => {
  const okcZaman = sonOkc.value ? new Date(sonOkc.value.zaman).getTime() : 0;
  const kartZaman = sonKart.value ? new Date(sonKart.value.zaman).getTime() : 0;
  const enYeni = Math.max(okcZaman, kartZaman);
  const yas = simdi.value.getTime() - enYeni;
  if (yas > 7000 || enYeni === 0) return 'idle';
  return okcZaman > kartZaman ? 'okc' : 'kart';
});

// LCD ekran satırları (16x4 karakter benzeri)
const lcd = computed(() => {
  if (aktif.value === 'idle') {
    return {
      durum: 'HAZIR' as const,
      satirlar: [
        'REBIRTH-MOCK 2.0',
        `Mali: 01:${String(0).padStart(4, '0')}`,
        `${tarihStr.value}  ${saatStr.value}`,
        'Satis bekleniyor',
      ],
    };
  }
  if (aktif.value === 'okc' && sonOkc.value) {
    const o = sonOkc.value;
    if (!o.basarili) {
      return {
        durum: 'HATA' as const,
        satirlar: [
          '!!! HATA !!!',
          (o.hata || 'Islem reddedildi').slice(0, 16),
          `${paraFormat(o.toplamTutar)}`,
          'Iptal icin C',
        ],
      };
    }
    const odemeKisa = o.odemeler.map((p) => kisaTip(p.tip)).join('+');
    return {
      durum: 'BASARILI' as const,
      satirlar: [
        'FIS KESILDI',
        (o.fisNo || '').slice(-16),
        `${paraFormat(o.toplamTutar)}`,
        `${odemeKisa} (${o.kalemSayisi}u)`,
      ],
    };
  }
  if (aktif.value === 'kart' && sonKart.value) {
    const k = sonKart.value;
    if (!k.basarili) {
      return {
        durum: 'HATA' as const,
        satirlar: [
          '!!! KART HATA !!!',
          (k.hata || 'Reddedildi').slice(0, 16),
          `${paraFormat(k.tutar)}`,
          'Iptal icin C',
        ],
      };
    }
    return {
      durum: 'BASARILI' as const,
      satirlar: [
        k.islem === 'IADE' ? 'IADE ONAY' : 'KART ONAY',
        (k.banka || 'Banka').slice(0, 16),
        `${paraFormat(k.tutar)}`,
        k.sonRakam ? `Kart **${k.sonRakam}` : 'Slip alindi',
      ],
    };
  }
  return {
    durum: 'HAZIR' as const,
    satirlar: ['REBIRTH-MOCK 2.0', '', `${tarihStr.value}  ${saatStr.value}`, 'Satis bekleniyor'],
  };
});

function kisaTip(t: string) {
  if (t === 'NAKIT') return 'NAK';
  if (t === 'KREDI_KARTI') return 'KRT';
  if (t === 'TICKET') return 'TIC';
  return t.slice(0, 3);
}

// ── İstatistikler ──
const buGunFis = computed(() => {
  const baslangic = new Date();
  baslangic.setHours(0, 0, 0, 0);
  return okcLog.value.filter((l) => l.basarili && new Date(l.zaman) >= baslangic).length;
});
const buGunCiro = computed(() => {
  const baslangic = new Date();
  baslangic.setHours(0, 0, 0, 0);
  return okcLog.value
    .filter((l) => l.basarili && new Date(l.zaman) >= baslangic)
    .reduce((s, l) => s + l.toplamTutar, 0);
});

// ── Animasyonlar ──
const yaziciAktif = ref(false);
function tetikleYazici() {
  yaziciAktif.value = true;
  setTimeout(() => (yaziciAktif.value = false), 2200);
}

// Bip sesi (Web Audio API)
let audioCtx: AudioContext | null = null;
function tetikleBip() {
  if (!import.meta.client) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    osc.type = 'square';
    gain.gain.value = 0.05;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.08);
  } catch {}
}

// LED durumları
const led = computed(() => ({
  hazir: aktif.value === 'idle' || lcd.value.durum === 'BASARILI',
  islem: false, // şu an aktif işlem yok (her şey async tamamlanıyor)
  hata: lcd.value.durum === 'HATA',
}));

// Bağlantı durumu
const bagli = computed(() => durum.value !== null);
const testMod = computed(() => durum.value?.okc.testMod || 'AUTO');

// Manuel ses test
const sesAcik = ref(false);
function sesToggle() {
  sesAcik.value = !sesAcik.value;
  if (sesAcik.value) tetikleBip();
}
</script>

<template>
  <div class="fixed inset-0 overflow-hidden flex flex-col items-center justify-center p-4"
    style="background: radial-gradient(ellipse at center, #2a2a2e 0%, #18181c 100%);"
  >
    <!-- Üst başlık şeridi -->
    <div class="absolute top-0 left-0 right-0 px-5 py-3 flex items-center justify-between text-white/60 text-xs">
      <div class="flex items-center gap-2">
        <i class="fas fa-microchip text-amber-400" />
        <span class="uppercase tracking-extra-wide font-semibold">Beko-Mock Test Cihazı · GMP-3</span>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex items-center gap-1.5">
          <span :class="['w-2 h-2 rounded-full', bagli ? 'bg-emerald-400 animate-pulse' : 'bg-red-500']" />
          <span>{{ bagli ? 'BAĞLI' : 'KOPUK' }}</span>
        </div>
        <div>Mod: <b class="text-amber-400">{{ testMod }}</b></div>
        <button
          @click="sesToggle"
          :title="sesAcik ? 'Sesi kapat' : 'Sesi aç'"
          class="text-white/60 hover:text-amber-400 transition"
        >
          <i :class="['fas', sesAcik ? 'fa-volume-high' : 'fa-volume-xmark']" />
        </button>
      </div>
    </div>

    <!-- CİHAZIN KENDİSİ -->
    <div class="relative">
      <!-- Termal kağıt (cihazın üstünden çıkar) — hibrit cihazlarda fiş + slip aynı kağıt -->
      <div class="absolute -top-2 left-1/2 -translate-x-1/2 w-[220px] flex flex-col items-center pointer-events-none">
        <div
          v-if="yaziciAktif"
          class="thermal-paper bg-white rounded-sm shadow-lg px-3 py-2 text-[8px] font-mono text-black leading-tight w-full"
        >
          <div class="text-center font-bold border-b border-dashed border-black/30 pb-1 mb-1">
            REBIRTH POS
          </div>
          <div class="flex justify-between">
            <span>FİŞ NO</span>
            <span>{{ sonOkc?.fisNo?.slice(-10) || '—' }}</span>
          </div>
          <div class="flex justify-between font-bold">
            <span>TOPLAM</span>
            <span>{{ paraFormat(sonOkc?.toplamTutar || 0) }}</span>
          </div>
          <div v-if="sonOkc?.kdvDokumu?.length" class="text-[7px] mt-1 pt-1 border-t border-dashed border-black/30">
            <div v-for="d in sonOkc.kdvDokumu" :key="d.oran" class="flex justify-between">
              <span>KDV %{{ d.oran }}</span>
              <span>{{ paraFormat(d.kdv) }}</span>
            </div>
          </div>
          <!-- Slip bölümü — kartla ödendiyse aynı kağıtta -->
          <div v-if="sonKart && sonKart.basarili" class="text-[7px] mt-1 pt-1 border-t border-dashed border-black/30">
            <div class="text-center font-bold mb-0.5">— BANKA SLİP —</div>
            <div v-if="sonKart.banka" class="flex justify-between">
              <span>{{ sonKart.banka }}</span>
              <span>**{{ sonKart.sonRakam }}</span>
            </div>
            <div class="flex justify-between">
              <span>Slip</span>
              <span>{{ sonKart.slipNo }}</span>
            </div>
          </div>
          <div class="flex justify-between text-[7px] mt-1 pt-1 border-t border-dashed border-black/30">
            <span>{{ new Date().toLocaleDateString('tr-TR') }}</span>
            <span>{{ new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>
        </div>
      </div>

      <!-- Cihaz gövdesi -->
      <div class="cihaz-govdesi relative">
        <!-- Marka şeridi (üst) -->
        <div class="absolute top-2 left-0 right-0 text-center text-[9px] uppercase tracking-extra-wide text-white/30 font-bold">
          REBIRTH-MOCK YAZARKASA·POS
        </div>

        <!-- Termal yazıcı slot (üst) -->
        <div class="absolute top-6 left-1/2 -translate-x-1/2 w-[210px] h-2 bg-black/80 rounded shadow-inner flex items-center justify-center gap-px overflow-hidden">
          <div v-for="i in 40" :key="i" class="w-px h-1 bg-white/10" />
        </div>

        <!-- LCD ekran -->
        <div class="lcd-ekran mt-12">
          <!-- LCD üst şerit (status icons) -->
          <div class="lcd-status">
            <div class="flex items-center gap-2 text-[10px]">
              <i class="fas fa-signal" />
              <i class="fas fa-wifi" />
              <i class="fas fa-shield-halved" />
            </div>
            <div class="tabular">{{ saatStr }}</div>
          </div>
          <!-- LCD içerik (4 satır × 16 karakter) -->
          <div
            :class="[
              'lcd-icerik',
              lcd.durum === 'HATA' && 'lcd-hata',
              lcd.durum === 'BASARILI' && 'lcd-basarili',
            ]"
          >
            <div v-for="(s, i) in lcd.satirlar" :key="i" class="lcd-satir">
              {{ s.padEnd(16, ' ').slice(0, 16) }}
            </div>
          </div>
        </div>

        <!-- LED durum göstergeleri -->
        <div class="led-row">
          <div class="led-item">
            <div :class="['led-bulb', led.hazir ? 'led-on-green' : 'led-off']" />
            <span>HAZIR</span>
          </div>
          <div class="led-item">
            <div :class="['led-bulb', yaziciAktif ? 'led-on-amber animate-pulse' : 'led-off']" />
            <span>YAZICI</span>
          </div>
          <div class="led-item">
            <div :class="['led-bulb', led.hata ? 'led-on-red animate-pulse' : 'led-off']" />
            <span>HATA</span>
          </div>
        </div>

        <!-- TUŞ TAKIMI -->
        <div class="tus-takimi">
          <!-- Fonksiyon tuşları (üst) -->
          <div class="grid grid-cols-4 gap-1.5 mb-1.5">
            <button class="tus-fonk">F1</button>
            <button class="tus-fonk">F2</button>
            <button class="tus-fonk">F3</button>
            <button class="tus-fonk">F4</button>
          </div>
          <!-- Numerik (3×4) + sağ aksiyon (1×4) -->
          <div class="grid grid-cols-4 gap-1.5">
            <button class="tus">1</button>
            <button class="tus">2</button>
            <button class="tus">3</button>
            <button class="tus tus-iptal">İPT</button>

            <button class="tus">4</button>
            <button class="tus">5</button>
            <button class="tus">6</button>
            <button class="tus tus-temizle">C</button>

            <button class="tus">7</button>
            <button class="tus">8</button>
            <button class="tus">9</button>
            <button class="tus tus-onay">✓</button>

            <button class="tus">*</button>
            <button class="tus">0</button>
            <button class="tus">,</button>
            <button class="tus tus-onay-big">↵</button>
          </div>
        </div>

        <!-- NFC alanı (sağ alt köşe) -->
        <div class="nfc-alan">
          <i class="fas fa-wifi rotate-90 text-amber-400/40 text-lg" />
          <div class="text-[7px] text-white/30 mt-0.5 text-center">NFC</div>
        </div>

        <!-- Marka logosu (alt) -->
        <div class="absolute bottom-2 left-0 right-0 text-center text-[8px] text-white/20 tracking-widest">
          REBIRTH POS · MOCK GMP-3 TEST
        </div>
      </div>
    </div>

    <!-- ALT BİLGİ ŞERİDİ -->
    <div class="absolute bottom-0 left-0 right-0 px-5 py-3 grid grid-cols-3 gap-4 text-center text-white/60 text-xs">
      <div>
        <div class="text-[10px] uppercase tracking-extra-wide text-white/40 font-semibold">Bugün Fiş</div>
        <div class="text-lg font-bold text-amber-400 tabular">{{ buGunFis }}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-extra-wide text-white/40 font-semibold">Bugün Ciro</div>
        <div class="text-lg font-bold text-amber-400 tabular">{{ paraFormat(buGunCiro) }}</div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-extra-wide text-white/40 font-semibold">Son İşlem</div>
        <div class="text-lg font-bold text-amber-400 tabular">
          {{ sonOkc ? new Date(sonOkc.zaman).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—' }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ── Cihaz gövdesi (Beko Hugin / Verifone tarzı) ── */
.cihaz-govdesi {
  width: 340px;
  background: linear-gradient(180deg, #2c2c30 0%, #1f1f23 100%);
  border-radius: 28px;
  padding: 32px 22px 22px;
  box-shadow:
    0 30px 80px -20px rgba(0, 0, 0, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.05),
    inset 0 -2px 0 rgba(0, 0, 0, 0.5);
  position: relative;
}
.cihaz-govdesi::before {
  content: '';
  position: absolute;
  inset: 4px;
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.03);
  pointer-events: none;
}

/* ── LCD ekran (yeşil mono klasik) ── */
.lcd-ekran {
  background: linear-gradient(180deg, #1a3a1a 0%, #0d2510 100%);
  border-radius: 8px;
  padding: 6px 10px;
  box-shadow:
    inset 0 0 12px rgba(0, 0, 0, 0.8),
    0 1px 0 rgba(255, 255, 255, 0.05),
    0 0 0 2px #0a0a0c;
  margin-bottom: 14px;
  font-family: 'Courier New', monospace;
}
.lcd-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #6fff8a;
  font-size: 10px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(111, 255, 138, 0.15);
  margin-bottom: 4px;
}
.lcd-icerik {
  font-family: 'Courier New', monospace;
  white-space: pre;
  letter-spacing: 0.05em;
  padding: 4px 0;
  transition: all 0.3s ease;
}
.lcd-satir {
  font-size: 13px;
  line-height: 1.4;
  color: #8fff9c;
  text-shadow:
    0 0 4px rgba(143, 255, 156, 0.6),
    0 0 12px rgba(143, 255, 156, 0.3);
}
.lcd-basarili .lcd-satir {
  color: #b8ffae;
  text-shadow:
    0 0 6px rgba(184, 255, 174, 0.8),
    0 0 16px rgba(184, 255, 174, 0.4);
  animation: lcdSuccess 0.5s ease-out;
}
.lcd-hata .lcd-satir {
  color: #ff8a8a;
  text-shadow:
    0 0 6px rgba(255, 138, 138, 0.8),
    0 0 16px rgba(255, 138, 138, 0.4);
  animation: lcdHata 0.4s ease-out;
}
@keyframes lcdSuccess {
  0% { transform: scale(0.97); opacity: 0.5; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes lcdHata {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-3px); }
  40% { transform: translateX(3px); }
  60% { transform: translateX(-2px); }
  80% { transform: translateX(2px); }
}

/* ── LED'ler ── */
.led-row {
  display: flex;
  justify-content: space-around;
  margin-bottom: 12px;
  padding: 0 6px;
}
.led-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 600;
}
.led-bulb {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  box-shadow: inset 0 1px 1px rgba(0, 0, 0, 0.4);
  transition: all 0.3s ease;
}
.led-off { background: rgba(255, 255, 255, 0.05); }
.led-on-green {
  background: radial-gradient(circle at 30% 30%, #b6ffb6, #2dd45e 60%, #168834);
  box-shadow:
    0 0 6px rgba(45, 212, 94, 0.7),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}
.led-on-amber {
  background: radial-gradient(circle at 30% 30%, #ffe9a0, #f5a623 60%, #b06700);
  box-shadow:
    0 0 8px rgba(245, 166, 35, 0.8),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}
.led-on-red {
  background: radial-gradient(circle at 30% 30%, #ffb6b6, #d42d2d 60%, #881616);
  box-shadow:
    0 0 8px rgba(212, 45, 45, 0.8),
    inset 0 1px 1px rgba(255, 255, 255, 0.4);
}

/* ── Tuş takımı ── */
.tus-takimi {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 4px;
}
.tus {
  background: linear-gradient(180deg, #3a3a3e 0%, #2a2a2e 100%);
  color: rgba(255, 255, 255, 0.85);
  border: none;
  border-radius: 8px;
  padding: 10px 0;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 600;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 2px 0 rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: all 0.1s ease;
}
.tus:hover { background: linear-gradient(180deg, #45454a 0%, #353539 100%); }
.tus:active {
  transform: translateY(1px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.4);
}
.tus-fonk {
  background: linear-gradient(180deg, #4a4a52 0%, #303034 100%);
  color: rgba(255, 255, 255, 0.6);
  border: none;
  border-radius: 6px;
  padding: 6px 0;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  cursor: pointer;
}
.tus-fonk:hover { background: linear-gradient(180deg, #55555c 0%, #38383d 100%); }
.tus-iptal {
  background: linear-gradient(180deg, #b03030 0%, #801818 100%);
  color: #fff;
  font-size: 11px;
}
.tus-temizle {
  background: linear-gradient(180deg, #c08020 0%, #905010 100%);
  color: #fff;
  font-size: 11px;
}
.tus-onay, .tus-onay-big {
  background: linear-gradient(180deg, #2d8838 0%, #16601e 100%);
  color: #fff;
}

/* ── NFC alanı ── */
.nfc-alan {
  position: absolute;
  bottom: 28px;
  right: -2px;
  width: 36px;
  height: 60px;
  background: linear-gradient(135deg, #3a3a3e 0%, #2a2a2e 100%);
  border-radius: 8px 0 0 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    -2px 2px 6px rgba(0, 0, 0, 0.4);
}

/* ── Termal kağıt animasyonu ── */
.thermal-paper {
  animation: paperFeed 2.2s ease-out;
  transform-origin: top;
}
@keyframes paperFeed {
  0% { max-height: 0; opacity: 0; padding-top: 0; padding-bottom: 0; overflow: hidden; }
  20% { max-height: 200px; opacity: 1; padding-top: 8px; padding-bottom: 8px; }
  80% { max-height: 200px; opacity: 1; transform: translateY(0); }
  100% { max-height: 200px; opacity: 0; transform: translateY(40px); }
}
</style>
