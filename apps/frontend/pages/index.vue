<script setup lang="ts">
import { paraFormat, gecenSure } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface GunSonu {
  toplamSatis: number;
  adisyonSayisi: number;
  toplamKalem: number;
  ortalamaAdisyon: number;
  saatBazli: { saat: number; tutar: number }[];
  enCokSatanlar: { ad: string; adet: number; tutar: number }[];
  odemeTipleri: { tip: string; tutar: number; sayi: number }[];
}

interface AktifAdisyon {
  id: string;
  numara: string;
  toplamTutar: string | number;
  acilis: string;
  masa?: { ad: string } | null;
  durum: string;
}

interface Masa {
  id: string;
  durum: 'BOS' | 'DOLU' | 'REZERVE' | 'ODEME_BEKLIYOR';
}

const auth = useAuthStore();
const sube = useSubeStore();
const rapor = ref<GunSonu | null>(null);
const adisyonlar = ref<AktifAdisyon[]>([]);
const masalar = ref<Masa[]>([]);
const yukleniyor = ref(false);
const { on } = useSocket();

async function yukle() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const [r, a, m] = await Promise.all([
      apiFetch<GunSonu>(`/raporlar/gunsonu?subeId=${sube.aktifSubeId}`),
      apiFetch<AktifAdisyon[]>(`/adisyonlar?subeId=${sube.aktifSubeId}`),
      apiFetch<Masa[]>(`/masalar?subeId=${sube.aktifSubeId}`),
    ]);
    rapor.value = r;
    adisyonlar.value = a;
    masalar.value = m;
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => yukle(), { immediate: true });

onMounted(() => {
  yukle();
  const off1 = on('siparis:yeni', () => yukle());
  const off2 = on('adisyon:guncel', () => yukle());
  const off3 = on('odeme:yeni', () => yukle());
  const off4 = on('masa:guncel', () => yukle());
  onUnmounted(() => { off1?.(); off2?.(); off3?.(); off4?.(); });
});

const masaDurum = computed(() => {
  const m = { BOS: 0, DOLU: 0, REZERVE: 0, ODEME_BEKLIYOR: 0 };
  for (const x of masalar.value) m[x.durum]++;
  return m;
});

const selam = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
});

const aktifAdisyonSayisi = computed(() =>
  adisyonlar.value.filter((a) => a.durum === 'ACIK' || a.durum === 'ODEME_BEKLIYOR').length,
);

const doluluk = computed(() =>
  Math.round((masaDurum.value.DOLU / Math.max(1, masalar.value.length)) * 100),
);

const moduller = [
  { ad: 'Masalar', yol: '/masalar', ikon: 'fa-table', sayi: () => masalar.value.filter(m => m.durum === 'DOLU').length, etiket: 'dolu' },
  { ad: 'Hızlı Satış', yol: '/hizli', ikon: 'fa-bolt' },
  { ad: 'Paket Servis', yol: '/paket', ikon: 'fa-motorcycle' },
  { ad: 'Mutfak', yol: '/mutfak', ikon: 'fa-fire' },
  { ad: 'Ürünler', yol: '/urunler', ikon: 'fa-utensils' },
  { ad: 'Stok', yol: '/stok', ikon: 'fa-boxes-stacked' },
  { ad: 'Müşteriler', yol: '/musteriler', ikon: 'fa-address-book' },
  { ad: 'Raporlar', yol: '/raporlar', ikon: 'fa-chart-line' },
];

const simdiSaat = ref(new Date());
let saatTimer: any;
onMounted(() => {
  saatTimer = setInterval(() => (simdiSaat.value = new Date()), 1000);
});
onUnmounted(() => clearInterval(saatTimer));

const saatStr = computed(() => simdiSaat.value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }));
const saniyeStr = computed(() => simdiSaat.value.toLocaleTimeString('tr-TR', { second: '2-digit' }));
const tarihStr = computed(() =>
  simdiSaat.value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }),
);

const sonHareketler = computed(() =>
  adisyonlar.value.slice(0, 6).map((a) => ({
    id: a.id,
    icon: a.durum === 'ODEME_BEKLIYOR' ? 'fa-credit-card' : 'fa-receipt',
    metin: `${a.masa?.ad || 'Masasız'} · ${paraFormat(a.toplamTutar)}`,
    aciklama: a.numara,
    zaman: gecenSure(a.acilis),
    yol: `/adisyon/${a.id}`,
  })),
);

// ── Saatlik ciro mini grafik ──
const sparklinePath = computed(() => {
  const data = rapor.value?.saatBazli || [];
  if (!data.length) return '';
  const max = Math.max(...data.map((d) => d.tutar), 1);
  const w = 100;
  const h = 24;
  const step = w / Math.max(1, data.length - 1);
  return data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${(i * step).toFixed(2)} ${(h - (d.tutar / max) * h).toFixed(2)}`)
    .join(' ');
});

const sparklineAreaPath = computed(() => {
  if (!sparklinePath.value) return '';
  return `${sparklinePath.value} L 100 24 L 0 24 Z`;
});
</script>

<template>
  <!-- Tam masaüstü düzeni: viewport'a sığar, sayfa içi scroll yok -->
  <div class="flex flex-col gap-3 sm:gap-4 h-[calc(100vh-7.5rem)] min-h-[36rem]">
    <!-- ÜST: Selam + Tarih/Saat (kompakt hero) -->
    <section
      class="hero-banner shrink-0 px-5 sm:px-7 py-4 sm:py-5 flex items-center justify-between gap-4"
    >
      <div class="min-w-0">
        <p class="text-[10px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-1 flex items-center gap-2">
          <span class="status-dot-gold" />
          {{ selam }}
        </p>
        <h1 class="text-xl sm:text-2xl md:text-3xl font-light text-pearl tracking-tight truncate">
          {{ auth.user?.adSoyad }}
        </h1>
        <p class="text-xs text-pearl-60 flex items-center gap-1.5 mt-0.5 truncate">
          <i class="fas fa-store text-gold-primary/70 text-[10px]" />
          {{ sube.aktifSube?.ad || '—' }}
        </p>
      </div>
      <div class="text-right shrink-0">
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-0.5">
          {{ tarihStr }}
        </div>
        <div class="flex items-end justify-end gap-1">
          <div class="text-3xl sm:text-4xl md:text-5xl font-extralight gold-text-shimmer tabular leading-none">
            {{ saatStr }}
          </div>
          <div class="hidden sm:block text-base text-gold-primary/60 font-extralight tabular leading-none mb-1">
            :{{ saniyeStr }}
          </div>
        </div>
      </div>
    </section>

    <!-- KPI ŞERİDİ (kompakt) -->
    <section class="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 shrink-0">
      <div class="kpi-card !p-3 sm:!p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Bugün Ciro</span>
          <i class="fas fa-coins text-gold-primary/60 text-sm" />
        </div>
        <div class="text-lg sm:text-xl md:text-2xl font-light gold-text tabular leading-none">
          {{ paraFormat(rapor?.toplamSatis || 0) }}
        </div>
        <div class="flex items-center justify-between mt-2 gap-2">
          <div class="text-[10px] text-pearl-50 tabular whitespace-nowrap">{{ rapor?.adisyonSayisi || 0 }} adisyon</div>
          <svg
            v-if="sparklinePath"
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            class="flex-1 h-5 overflow-visible"
          >
            <defs>
              <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="rgba(200,154,42,0.30)" />
                <stop offset="100%" stop-color="rgba(200,154,42,0)" />
              </linearGradient>
            </defs>
            <path :d="sparklineAreaPath" fill="url(#spark-fill)" />
            <path :d="sparklinePath" fill="none" stroke="#c89a2a" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
      </div>

      <div class="kpi-card !p-3 sm:!p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Aktif Adisyon</span>
          <i class="fas fa-receipt text-pearl-60 text-sm" />
        </div>
        <div class="text-lg sm:text-xl md:text-2xl font-light text-pearl tabular leading-none">
          {{ aktifAdisyonSayisi }}
        </div>
        <div class="text-[10px] text-pearl-50 mt-2 flex items-center gap-1.5">
          <span class="status-dot-emerald" />Açık masa
        </div>
      </div>

      <div class="kpi-card !p-3 sm:!p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Doluluk</span>
          <i class="fas fa-table text-pearl-60 text-sm" />
        </div>
        <div class="text-lg sm:text-xl md:text-2xl font-light text-pearl tabular leading-none">
          {{ masaDurum.DOLU }}<span class="text-pearl-50 text-sm sm:text-base ml-1">/ {{ masalar.length }}</span>
        </div>
        <div class="mt-2">
          <div class="h-1 rounded-full bg-pearl-10 overflow-hidden">
            <div
              class="h-full rounded-full bg-gold-gradient transition-all duration-700"
              :style="{ width: doluluk + '%' }"
            />
          </div>
          <div class="text-[10px] text-pearl-50 mt-1 tabular">{{ doluluk }}% kullanımda</div>
        </div>
      </div>

      <div class="kpi-card !p-3 sm:!p-4">
        <div class="flex items-center justify-between mb-1">
          <span class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Ortalama</span>
          <i class="fas fa-chart-line text-pearl-60 text-sm" />
        </div>
        <div class="text-lg sm:text-xl md:text-2xl font-light text-pearl tabular leading-none">
          {{ paraFormat(rapor?.ortalamaAdisyon || 0) }}
        </div>
        <div class="text-[10px] text-pearl-50 mt-2 tabular">{{ rapor?.toplamKalem || 0 }} kalem</div>
      </div>
    </section>

    <!-- ANA ALAN: Modüller (sol, flex-1) + Yan Panel (sağ, sabit genişlik) -->
    <div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-3 sm:gap-4 flex-1 min-h-0">
      <!-- MODÜL IZGARASI — yatay kompakt kartlar -->
      <section class="flex flex-col min-h-0">
        <div class="section-title !mb-2 flex items-center gap-2 shrink-0">
          <span class="w-1 h-3 rounded-full bg-gold-gradient" />
          Modüller
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3 flex-1 min-h-0 auto-rows-fr">
          <NuxtLink
            v-for="m in moduller"
            :key="m.yol"
            :to="m.yol"
            class="module-tile group no-tap-highlight"
          >
            <div class="module-tile-icon">
              <i :class="['fas', m.ikon]" />
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-sm md:text-base font-medium text-pearl truncate">{{ m.ad }}</div>
              <div
                v-if="m.sayi && m.sayi() > 0"
                class="text-[10px] uppercase tracking-extra-wide text-gold-primary font-semibold tabular flex items-center gap-1 mt-0.5"
              >
                <span class="status-dot-gold" />{{ m.sayi() }} {{ m.etiket }}
              </div>
              <div v-else class="text-[10px] uppercase tracking-extra-wide text-pearl-50 mt-0.5">
                Aç
              </div>
            </div>
            <i class="fas fa-chevron-right text-pearl-30 text-xs group-hover:text-gold-primary group-hover:translate-x-1 transition" />
          </NuxtLink>
        </div>
      </section>

      <!-- YAN PANEL — bildirimler + masa durumu (tam yükseklik scroll) -->
      <aside class="flex flex-col gap-3 min-h-0">
        <!-- Bildirimler -->
        <div class="card-luxe p-4 flex flex-col min-h-0 flex-1">
          <div class="flex items-center justify-between mb-3 shrink-0">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-xl bg-gold-soft text-gold-primary flex items-center justify-center border border-gold-primary/25">
                <i class="fas fa-bell text-xs" />
              </div>
              <h3 class="text-xs font-semibold text-pearl tracking-wide uppercase">Bildirimler</h3>
            </div>
            <span v-if="sonHareketler.length" class="badge-gold !text-[9px] !py-0.5 !px-2">
              {{ sonHareketler.length }}
            </span>
          </div>

          <div v-if="!sonHareketler.length" class="flex-1 flex flex-col items-center justify-center text-pearl-60 text-sm">
            <i class="fas fa-bell-slash text-2xl text-pearl-40 mb-2 block" />
            Aktivite yok
          </div>

          <div v-else class="flex-1 min-h-0 overflow-y-auto -mx-1 px-1 space-y-0.5">
            <NuxtLink
              v-for="h in sonHareketler"
              :key="h.id"
              :to="h.yol"
              class="group flex items-start gap-2.5 p-2 rounded-lg hover:bg-pearl-5 transition"
            >
              <div class="w-8 h-8 rounded-lg bg-gold-soft border border-gold-primary/25 text-gold-primary flex items-center justify-center text-xs shrink-0 group-hover:scale-105 transition">
                <i :class="['fas', h.icon]" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium text-pearl truncate">{{ h.metin }}</div>
                <div class="text-[10px] text-pearl-50 truncate tabular">{{ h.aciklama }}</div>
              </div>
              <div class="text-[10px] text-pearl-50 tabular shrink-0 mt-0.5 whitespace-nowrap">{{ h.zaman }}</div>
            </NuxtLink>
          </div>
        </div>

        <!-- Masa durumu (sabit yükseklik) -->
        <div class="card-luxe p-4 shrink-0">
          <div class="section-title !mb-2 flex items-center gap-2">
            <span class="w-1 h-3 rounded-full bg-gold-gradient" />
            Masa Durumu
          </div>
          <div class="grid grid-cols-2 gap-x-3 gap-y-1.5">
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-2 text-xs text-pearl-80">
                <span class="status-dot-emerald" />Boş
              </span>
              <span class="font-medium tabular text-pearl text-sm">{{ masaDurum.BOS }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-2 text-xs text-pearl-80">
                <span class="status-dot-gold" />Dolu
              </span>
              <span class="font-medium tabular text-pearl text-sm">{{ masaDurum.DOLU }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-2 text-xs text-pearl-80">
                <span class="status-dot-blue" />Ödeme
              </span>
              <span class="font-medium tabular text-pearl text-sm">{{ masaDurum.ODEME_BEKLIYOR }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="flex items-center gap-2 text-xs text-pearl-80">
                <span class="w-2 h-2 rounded-full bg-amber-500" />Rezerve
              </span>
              <span class="font-medium tabular text-pearl text-sm">{{ masaDurum.REZERVE }}</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
/* Yatay kompakt modül kartı — masaüstü uygulaması hissi.
   Aspect-square'dan kurtulup gerçek "satır" tipi tile yapısı kullanıyoruz. */
.module-tile {
  @apply relative overflow-hidden bg-white border border-pearl-10 rounded-2xl
         p-3 sm:p-4 flex items-center gap-3 transition-all cursor-pointer
         text-left min-h-0;
  box-shadow: 0 4px 16px -8px rgba(28, 28, 32, 0.08);
}
.module-tile:hover {
  @apply border-gold-primary/40;
  transform: translateY(-2px);
  box-shadow:
    0 18px 36px -16px rgba(200, 154, 42, 0.30),
    0 0 0 1px rgba(200, 154, 42, 0.16);
}
.module-tile::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at top right, rgba(200, 154, 42, 0.14), transparent 60%);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}
.module-tile:hover::before { opacity: 1; }

.module-tile-icon {
  @apply w-11 h-11 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-xl text-gold-primary
         bg-gradient-to-br from-gold-primary/20 to-gold-primary/5
         border border-gold-primary/30 transition-all duration-300 shrink-0;
}
.module-tile:hover .module-tile-icon {
  @apply from-gold-primary/30 to-gold-primary/10 border-gold-primary/60;
  transform: scale(1.05);
  box-shadow: 0 0 24px rgba(200, 154, 42, 0.30);
}
</style>
