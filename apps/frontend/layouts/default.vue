<script setup lang="ts">
import { paraFormat } from '~/utils/format';

const auth = useAuthStore();
const sube = useSubeStore();
const { bagla, subeOdasinaKatil } = useSocket();
const { acik, mobilAc } = useSidebar();

function musteriEkraniAc() {
  if (!import.meta.client) return;
  const yol = window.location.origin + '/musteri-ekran';
  window.open(
    yol,
    'rebirth-musteri-ekran',
    'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no',
  );
}

// ── Aylık özet ──
interface AylikOzetDonem {
  adisyonSayisi: number;
  toplamSatis: number;
  toplamKdv: number;
  toplamIskonto: number;
  toplamBahsis: number;
  ortalamaAdisyon: number;
  odemeTipleri: { tip: string; tutar: number; sayi: number }[];
  kdvBantlari: { oran: number; matrah: number; kdv: number }[];
}
interface AylikOzet {
  ay: string;
  ayAdi: string;
  buAy: AylikOzetDonem;
  gecenAy: AylikOzetDonem;
  degisim: { toplamSatis: number; adisyonSayisi: number; ortalamaAdisyon: number };
  gunlukSeri: { gun: number; tarih: string; tutar: number }[];
}

const aylikModalAcik = ref(false);
const aylikYukleniyor = ref(false);
const aylikOzet = ref<AylikOzet | null>(null);

async function aylikOzetAc() {
  aylikModalAcik.value = true;
  if (aylikOzet.value) return; // cache — modal kapatılınca tekrar açıldığında yeniden çekmesin
  aylikYukleniyor.value = true;
  try {
    const params = sube.aktifSubeId ? `?subeId=${sube.aktifSubeId}` : '';
    aylikOzet.value = await apiFetch<AylikOzet>(`/raporlar/aylik${params}`);
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Aylık özet yüklenemedi');
    aylikModalAcik.value = false;
  } finally {
    aylikYukleniyor.value = false;
  }
}

function aylikRefresh() {
  aylikOzet.value = null;
  aylikOzetAc();
}

function tipEtiket(t: string) {
  if (t === 'NAKIT') return 'Nakit';
  if (t === 'KREDI_KARTI') return 'Kredi Kartı';
  if (t === 'TICKET') return 'Yemek Çeki';
  if (t === 'YEMEKSEPETI') return 'Yemeksepeti';
  return t;
}

const enYuksekGun = computed(() => {
  if (!aylikOzet.value?.gunlukSeri.length) return 1;
  return Math.max(...aylikOzet.value.gunlukSeri.map((g) => g.tutar), 1);
});

onMounted(async () => {
  auth.yukle();
  sube.yukleAktifSube();
  if (auth.girisYapilmis) {
    await sube.yukle();
    bagla();
  }
});

watch(
  () => sube.aktifSubeId,
  (yeni) => { if (yeni) subeOdasinaKatil(yeni); },
  { immediate: true },
);

const simdiSaat = ref(new Date());
let saatTimer: any;
onMounted(() => {
  saatTimer = setInterval(() => (simdiSaat.value = new Date()), 60000);
});
onUnmounted(() => clearInterval(saatTimer));

const saatStr = computed(() =>
  simdiSaat.value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
);
const tarihStr = computed(() =>
  simdiSaat.value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' }),
);
const kisaTarih = computed(() =>
  simdiSaat.value.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }),
);
</script>

<template>
  <div class="min-h-screen">
    <AppSidebar />
    <main
      :class="[
        'transition-[padding] duration-300',
        // Mobil: padding yok (sidebar drawer)
        // Desktop: sidebar genişliğine göre padding
        'pl-0',
        acik ? 'lg:pl-64' : 'lg:pl-20',
      ]"
    >
      <header
        class="sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 md:px-8 py-3
               border-b border-pearl-10 bg-ink-100/70 backdrop-blur-xl"
      >
        <!-- Mobil hamburger -->
        <button
          @click="mobilAc"
          class="lg:hidden w-10 h-10 rounded-xl bg-pearl-5 border border-pearl-20 hover:bg-pearl-10 hover:border-pearl-30 text-pearl transition flex items-center justify-center shrink-0"
          aria-label="Menüyü aç"
        >
          <i class="fas fa-bars" />
        </button>

        <!-- Tarih + saat (responsive) -->
        <div class="hidden sm:flex flex-col min-w-0">
          <div class="hidden md:block text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">{{ tarihStr }}</div>
          <div class="md:hidden text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">{{ kisaTarih }}</div>
          <div class="text-lg md:text-xl font-light text-pearl tracking-tight tabular">{{ saatStr }}</div>
        </div>

        <!-- Mobilde sadece saat -->
        <div class="sm:hidden flex flex-col">
          <div class="text-lg font-light text-pearl tracking-tight tabular leading-tight">{{ saatStr }}</div>
          <div class="text-[9px] uppercase tracking-extra-wide text-pearl-50 font-semibold leading-tight">{{ kisaTarih }}</div>
        </div>

        <div class="flex items-center gap-2 sm:gap-3 ml-auto min-w-0">
          <button
            @click="aylikOzetAc"
            class="w-10 h-10 rounded-xl bg-pearl-5 border border-pearl-20 hover:bg-gold-soft hover:border-gold-primary/40 hover:text-gold-primary text-pearl-70 transition flex items-center justify-center shrink-0"
            title="Aylık Özet"
          >
            <i class="fas fa-calendar-days" />
          </button>
          <button
            @click="musteriEkraniAc"
            class="w-10 h-10 rounded-xl bg-pearl-5 border border-pearl-20 hover:bg-gold-soft hover:border-gold-primary/40 hover:text-gold-primary text-pearl-70 transition flex items-center justify-center shrink-0"
            title="Müşteri Ekranını Aç"
          >
            <i class="fas fa-display" />
          </button>
          <SubeSecici />
        </div>
      </header>
      <div class="p-4 sm:p-5 lg:p-6 animate-fade-in">
        <slot />
      </div>
    </main>
    <AppToasts />
    <AppOnayModal />

    <!-- AYLIK ÖZET MODAL'I -->
    <AppModal
      :acik="aylikModalAcik"
      :baslik="aylikOzet ? `Aylık Özet · ${aylikOzet.ayAdi}` : 'Aylık Özet'"
      genislik="max-w-3xl"
      @kapat="aylikModalAcik = false"
    >
      <div v-if="aylikYukleniyor || !aylikOzet" class="py-16 text-center text-pearl-50">
        <i class="fas fa-spinner fa-spin text-2xl mb-2 block" />
        Veriler hesaplanıyor…
      </div>
      <div v-else class="space-y-5">
        <!-- Üst metrik kartları -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div class="surface-elevated p-3 relative overflow-hidden">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">Toplam Ciro</div>
            <div class="text-lg font-light gold-text tabular leading-none">{{ paraFormat(aylikOzet.buAy.toplamSatis) }}</div>
            <div :class="['text-[10px] mt-2 tabular font-semibold', aylikOzet.degisim.toplamSatis >= 0 ? 'text-emerald-700' : 'text-red-700']">
              <i :class="['fas mr-1', aylikOzet.degisim.toplamSatis >= 0 ? 'fa-arrow-up' : 'fa-arrow-down']" />
              %{{ Math.abs(aylikOzet.degisim.toplamSatis) }} vs geçen ay
            </div>
          </div>
          <div class="surface-elevated p-3">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">Adisyon</div>
            <div class="text-lg font-light text-pearl tabular leading-none">{{ aylikOzet.buAy.adisyonSayisi }}</div>
            <div :class="['text-[10px] mt-2 tabular font-semibold', aylikOzet.degisim.adisyonSayisi >= 0 ? 'text-emerald-700' : 'text-red-700']">
              <i :class="['fas mr-1', aylikOzet.degisim.adisyonSayisi >= 0 ? 'fa-arrow-up' : 'fa-arrow-down']" />
              %{{ Math.abs(aylikOzet.degisim.adisyonSayisi) }}
            </div>
          </div>
          <div class="surface-elevated p-3">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">Ortalama</div>
            <div class="text-lg font-light text-pearl tabular leading-none">{{ paraFormat(aylikOzet.buAy.ortalamaAdisyon) }}</div>
            <div :class="['text-[10px] mt-2 tabular font-semibold', aylikOzet.degisim.ortalamaAdisyon >= 0 ? 'text-emerald-700' : 'text-red-700']">
              <i :class="['fas mr-1', aylikOzet.degisim.ortalamaAdisyon >= 0 ? 'fa-arrow-up' : 'fa-arrow-down']" />
              %{{ Math.abs(aylikOzet.degisim.ortalamaAdisyon) }}
            </div>
          </div>
          <div class="surface-elevated p-3">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">Toplam KDV</div>
            <div class="text-lg font-light gold-text tabular leading-none">{{ paraFormat(aylikOzet.buAy.toplamKdv) }}</div>
            <div class="text-[10px] mt-2 tabular text-pearl-50">
              İskonto: {{ paraFormat(aylikOzet.buAy.toplamIskonto) }}
            </div>
          </div>
        </div>

        <!-- Günlük seri (bar chart) -->
        <div>
          <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2 flex items-center gap-2">
            <span class="w-1 h-3 rounded-full bg-gold-gradient" />
            Günlük Ciro Dağılımı
          </div>
          <div class="surface-elevated p-4">
            <div class="flex items-end gap-0.5 h-32">
              <div
                v-for="g in aylikOzet.gunlukSeri"
                :key="g.gun"
                class="flex-1 group relative cursor-default"
              >
                <div
                  :class="['rounded-t-sm transition-all', g.tutar > 0 ? 'bg-gradient-to-t from-gold-primary to-gold-bright' : 'bg-pearl-10']"
                  :style="{ height: ((g.tutar / enYuksekGun) * 100) + '%', minHeight: g.tutar > 0 ? '2px' : '2px' }"
                />
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-pearl text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition pointer-events-none whitespace-nowrap z-10">
                  {{ g.gun }} · {{ paraFormat(g.tutar) }}
                </div>
              </div>
            </div>
            <div class="flex items-center justify-between text-[10px] text-pearl-50 mt-2 tabular">
              <span>1</span>
              <span>15</span>
              <span>{{ aylikOzet.gunlukSeri.length }}</span>
            </div>
          </div>
        </div>

        <!-- Ödeme tipleri + KDV bantları -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2 flex items-center gap-2">
              <span class="w-1 h-3 rounded-full bg-gold-gradient" />
              Ödeme Dağılımı
            </div>
            <div class="surface-elevated p-3 space-y-2">
              <div v-if="!aylikOzet.buAy.odemeTipleri.length" class="text-xs text-pearl-50 text-center py-3">
                Bu ay ödeme yok
              </div>
              <div v-for="o in aylikOzet.buAy.odemeTipleri" :key="o.tip" class="text-xs">
                <div class="flex justify-between mb-1">
                  <span class="text-pearl-70">
                    <i :class="['fas mr-1', o.tip === 'NAKIT' ? 'fa-money-bill-wave text-emerald-600' : o.tip === 'KREDI_KARTI' ? 'fa-credit-card text-blue-600' : 'fa-ticket text-amber-600']" />
                    {{ tipEtiket(o.tip) }} <span class="text-pearl-50">({{ o.sayi }})</span>
                  </span>
                  <span class="font-semibold tabular">{{ paraFormat(o.tutar) }}</span>
                </div>
                <div class="h-1 bg-pearl-10 rounded-full overflow-hidden">
                  <div
                    class="h-full bg-gold-gradient rounded-full"
                    :style="{ width: ((o.tutar / aylikOzet.buAy.toplamSatis) * 100) + '%' }"
                  />
                </div>
              </div>
            </div>
          </div>
          <div>
            <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2 flex items-center gap-2">
              <span class="w-1 h-3 rounded-full bg-gold-gradient" />
              KDV Bantları
            </div>
            <div class="surface-elevated p-3">
              <div v-if="!aylikOzet.buAy.kdvBantlari.length" class="text-xs text-pearl-50 text-center py-3">
                KDV verisi yok
              </div>
              <table v-else class="w-full text-xs">
                <thead>
                  <tr class="text-[10px] text-pearl-50 border-b border-pearl-10">
                    <th class="text-left py-1 font-semibold">Oran</th>
                    <th class="text-right py-1 font-semibold">Matrah</th>
                    <th class="text-right py-1 font-semibold">KDV</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="b in aylikOzet.buAy.kdvBantlari" :key="b.oran" class="border-b border-pearl-5">
                    <td class="py-1 text-pearl-80">%{{ b.oran }}</td>
                    <td class="text-right py-1 tabular text-pearl">{{ paraFormat(b.matrah) }}</td>
                    <td class="text-right py-1 tabular text-gold-dark font-semibold">{{ paraFormat(b.kdv) }}</td>
                  </tr>
                  <tr class="font-semibold">
                    <td class="py-1 text-pearl">Toplam</td>
                    <td class="text-right py-1 tabular">
                      {{ paraFormat(aylikOzet.buAy.kdvBantlari.reduce((s, b) => s + b.matrah, 0)) }}
                    </td>
                    <td class="text-right py-1 tabular text-gold-dark">
                      {{ paraFormat(aylikOzet.buAy.kdvBantlari.reduce((s, b) => s + b.kdv, 0)) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Karşılaştırma -->
        <div class="bg-pearl-5 rounded-xl p-3 text-xs flex items-center justify-between">
          <div class="text-pearl-60">
            <i class="fas fa-circle-info text-gold-primary mr-1.5" />
            Geçen ay: <b class="text-pearl">{{ paraFormat(aylikOzet.gecenAy.toplamSatis) }}</b>
            · {{ aylikOzet.gecenAy.adisyonSayisi }} adisyon
          </div>
          <button @click="aylikRefresh" class="text-gold-dark hover:text-gold-primary transition">
            <i class="fas fa-rotate mr-1" />Yenile
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
