<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ layout: false });

interface Kalem {
  id: string;
  adet: number;
  birimFiyat: string | number;
  toplam: string | number;
  iptal: boolean;
  urun: { id: string; ad: string };
}

interface Siparis {
  kalemler: Kalem[];
}

interface Adisyon {
  id: string;
  numara: string;
  araToplam: string | number;
  iskontoTutar: string | number;
  toplamTutar: string | number;
  acilis: string;
  durum: string;
  masa?: { ad: string } | null;
  siparisler: Siparis[];
  odemeler: { tutar: string | number; iptal: boolean }[];
}

const auth = useAuthStore();
const sube = useSubeStore();
const musteri = useMusteriEkran();
const { on, bagla, subeOdasinaKatil } = useSocket();

const aktifAdisyonId = ref<string | null>(null);
const adisyon = ref<Adisyon | null>(null);
const odemeDurumu = ref(musteri.odemeDurumuOku());
const hizliSepet = ref(musteri.sepetOku());
const kartIslemi = ref(musteri.kartIslemiOku());
const tesekkurBitis = ref<number | null>(null);
const tesekkurTimer = ref<any>(null);

const simdiSaat = ref(new Date());

async function adisyonYukle(id: string) {
  // Auth yoksa hiç deneme — apiFetch 401'de login'e yönlendirir, müşteri
  // ekranı bunu yapmamalı. localStorage broadcast yine de welcome ekranı verir.
  if (!auth.girisYapilmis) {
    adisyon.value = null;
    return;
  }
  try {
    adisyon.value = await apiFetch<Adisyon>(`/adisyonlar/${id}`);
  } catch (e) {
    adisyon.value = null;
  }
}

function durumuTara() {
  const yeniTesekkur = musteri.tesekkurOku();
  if (yeniTesekkur && yeniTesekkur !== tesekkurBitis.value) {
    tesekkurBitis.value = yeniTesekkur;
    if (tesekkurTimer.value) clearTimeout(tesekkurTimer.value);
    tesekkurTimer.value = setTimeout(() => {
      tesekkurBitis.value = null;
      musteri.tesekkurTemizle();
    }, Math.max(0, yeniTesekkur - Date.now()));
  }

  odemeDurumu.value = musteri.odemeDurumuOku();
  hizliSepet.value = musteri.sepetOku();
  kartIslemi.value = musteri.kartIslemiOku();

  const yeniId = musteri.aktifAdisyonOku();
  if (yeniId !== aktifAdisyonId.value) {
    aktifAdisyonId.value = yeniId;
    if (yeniId) adisyonYukle(yeniId);
    else adisyon.value = null;
  }
}

onMounted(() => {
  auth.yukle();
  sube.yukleAktifSube();
  // Müşteri ekranı: auth varsa WebSocket + REST kullanır; yoksa sessizce
  // localStorage broadcast'ine güvenir. Her durumda welcome ekranı görünür.
  if (auth.girisYapilmis) {
    bagla();
    if (sube.aktifSubeId) subeOdasinaKatil(sube.aktifSubeId);
  }

  // ÖNCEKİ oturumdan kalmış stale verileri sıfırla.
  // (Geçmişte adisyon detayı sayfası mount'ta yazıyordu; eski versiyondan
  // kalan key'ler hala localStorage'da olabilir.)
  musteri.hepsiniTemizle();

  // İlk taramada artık her şey boş — kasa penceresi ödeme modali açıksa
  // BroadcastChannel ile state'ini yeniden yazsın.
  durumuTara();
  musteri.durumYenilemeTetikle();

  // localStorage değişikliklerini dinle (kasa penceresinden gelen yayınlar)
  const off = musteri.dinle(durumuTara);

  // Realtime: kasa adisyona kalem eklerse anında yansısın
  const off1 = on('siparis:yeni', (v: any) => {
    if (v?.adisyonId && v.adisyonId === aktifAdisyonId.value) adisyonYukle(v.adisyonId);
  });
  const off2 = on('adisyon:guncel', (v: any) => {
    if (v?.adisyonId && v.adisyonId === aktifAdisyonId.value) adisyonYukle(v.adisyonId);
  });
  const off3 = on('odeme:yeni', (v: any) => {
    if (v?.adisyonId && v.adisyonId === aktifAdisyonId.value) adisyonYukle(v.adisyonId);
  });

  // Saat
  const saatTimer = setInterval(() => (simdiSaat.value = new Date()), 1000);

  onUnmounted(() => {
    off();
    off1?.();
    off2?.();
    off3?.();
    clearInterval(saatTimer);
    if (tesekkurTimer.value) clearTimeout(tesekkurTimer.value);
  });
});

const tumKalemler = computed<Kalem[]>(() => {
  if (!adisyon.value) return [];
  return adisyon.value.siparisler.flatMap((s) => s.kalemler.filter((k) => !k.iptal));
});

const odenmis = computed(() =>
  (adisyon.value?.odemeler || []).filter((o) => !o.iptal).reduce((a, o) => a + Number(o.tutar), 0),
);

const kalan = computed(() =>
  Math.max(0, Number(adisyon.value?.toplamTutar || 0) - odenmis.value),
);

const saatStr = computed(() =>
  simdiSaat.value.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
);
const tarihStr = computed(() =>
  simdiSaat.value.toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }),
);

const selam = computed(() => {
  const h = simdiSaat.value.getHours();
  if (h < 6) return 'Hoş Geldiniz';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'Hoş Geldiniz';
  return 'İyi Akşamlar';
});

// Durum: hangi ekran gösteriliyor?
const ekran = computed<'kart' | 'tesekkur' | 'odeme' | 'aktif' | 'sepet' | 'bos'>(() => {
  if (kartIslemi.value && kartIslemi.value.durum === 'cekiliyor') return 'kart';
  if (tesekkurBitis.value && Date.now() < tesekkurBitis.value) return 'tesekkur';
  if (odemeDurumu.value) return 'odeme';
  if (adisyon.value && tumKalemler.value.length) return 'aktif';
  if (hizliSepet.value && hizliSepet.value.kalemler?.length) return 'sepet';
  return 'bos';
});

// Son eklenen kalem (pop animasyonu için)
const sonKalemId = ref<string | null>(null);
watch(tumKalemler, (yeni, eski) => {
  if (!eski) return;
  const eskiIds = new Set(eski.map((k) => k.id));
  const son = yeni.find((k) => !eskiIds.has(k.id));
  if (son) {
    sonKalemId.value = son.id;
    setTimeout(() => {
      if (sonKalemId.value === son.id) sonKalemId.value = null;
    }, 1500);
  }
});

// Geçen süre — adisyon süresi
const adisyonSuresi = computed(() => {
  if (!adisyon.value) return '';
  const start = new Date(adisyon.value.acilis).getTime();
  const diff = Math.floor((simdiSaat.value.getTime() - start) / 60000);
  if (diff < 1) return 'Yeni';
  if (diff < 60) return `${diff} dk`;
  return `${Math.floor(diff / 60)}sa ${diff % 60}dk`;
});
</script>

<template>
  <div
    class="fixed inset-0 overflow-hidden text-pearl flex flex-col"
    style="background: radial-gradient(ellipse 70% 60% at 50% 0%, rgba(200,154,42,0.18) 0%, transparent 60%), radial-gradient(ellipse 60% 60% at 100% 100%, rgba(230,196,82,0.12) 0%, transparent 55%), linear-gradient(180deg, #fdfcf9 0%, #f5f3ed 100%);"
  >
    <!-- DEKORATİF ARKA PLAN -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1400px] h-[800px] bg-gold-primary/[0.14] blur-[180px] rounded-full animate-float" />
      <div class="absolute bottom-0 right-0 w-[700px] h-[700px] bg-gold-bright/[0.12] blur-[140px] rounded-full" />
      <div class="absolute top-1/3 left-0 w-[500px] h-[500px] bg-gold-primary/[0.08] blur-[140px] rounded-full" />
      <div
        class="absolute inset-0 opacity-50"
        style="background-image: radial-gradient(rgba(200,154,42,0.18) 1px, transparent 1px); background-size: 32px 32px; mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%); -webkit-mask-image: radial-gradient(ellipse at center, black 30%, transparent 75%);"
      />
    </div>

    <!-- Üst & alt altın çizgileri -->
    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/70 to-transparent" />
    <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/40 to-transparent" />

    <!-- ÜST BAR -->
    <header class="relative z-10 flex items-center justify-between px-8 lg:px-12 py-6">
      <div class="flex items-center gap-4">
        <div class="relative w-14 h-14">
          <div class="absolute inset-0 rounded-2xl border border-gold-primary/30 rotate-45" />
          <div class="absolute inset-2 bg-gradient-to-br from-gold-primary/25 to-gold-primary/5 rounded-xl" />
          <i class="fas fa-utensils text-2xl text-gold-primary absolute inset-0 flex items-center justify-center" />
        </div>
        <div>
          <div class="text-2xl font-extralight tracking-extra-wide text-pearl">REBIRTH</div>
          <div class="text-[10px] uppercase tracking-extra-wide text-gold-light flex items-center gap-1.5">
            <i class="fas fa-store text-[9px]" />
            {{ sube.aktifSube?.ad || '—' }}
          </div>
        </div>
      </div>

      <div class="text-right">
        <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold">{{ tarihStr }}</div>
        <div class="text-3xl lg:text-4xl font-extralight gold-text-shimmer tabular leading-tight">{{ saatStr }}</div>
      </div>
    </header>

    <!-- ANA İÇERİK — duruma göre -->
    <main class="relative z-10 flex-1 overflow-hidden flex flex-col">
      <!-- ◇ Boş durum: hoş geldiniz ekranı -->
      <Transition
        enter-active-class="transition duration-500 ease-luxe"
        leave-active-class="transition duration-300"
        enter-from-class="opacity-0 scale-95"
        leave-to-class="opacity-0 scale-95"
      >
        <section
          v-if="ekran === 'bos'"
          class="flex-1 flex items-center justify-center px-8 lg:px-16"
        >
          <div class="text-center max-w-2xl animate-slide-up">
            <div class="relative inline-flex items-center justify-center w-32 h-32 mb-10">
              <div class="absolute inset-0 rounded-[2rem] border border-gold-primary/50 rotate-12 shadow-[0_8px_32px_-8px_rgba(200,154,42,0.35)]" />
              <div class="absolute inset-1 rounded-[1.85rem] border border-gold-primary/35 -rotate-6" />
              <div class="absolute inset-3 bg-gradient-to-br from-gold-primary/35 to-gold-primary/10 rounded-3xl border border-gold-primary/25" />
              <i class="fas fa-utensils text-5xl text-gold-primary relative z-10 drop-shadow-[0_2px_8px_rgba(200,154,42,0.45)]" />
              <div class="absolute -inset-3 rounded-[2.25rem] border border-gold-primary/30 animate-pulse-gold" />
            </div>

            <div class="text-[11px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-3">
              {{ selam }}
            </div>
            <h1 class="text-6xl lg:text-7xl font-extralight gold-text-shimmer tracking-tight mb-4">
              REBIRTH
            </h1>
            <div class="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-gold-primary to-transparent mb-6" />
            <div class="flex items-center justify-center gap-3 text-sm uppercase tracking-extra-wide text-pearl-60 mb-12">
              <span class="w-16 h-px bg-gradient-to-r from-transparent to-gold-primary/60" />
              <span>Sipariş Almaya Hazır</span>
              <span class="w-16 h-px bg-gradient-to-l from-transparent to-gold-primary/60" />
            </div>

            <p class="text-pearl-70 max-w-md mx-auto leading-relaxed">
              Lezzetli yemeklerimizden seçim yapmak için kasamızdaki personelimize başvurabilirsiniz.
            </p>
          </div>
        </section>

        <!-- ◇ Aktif adisyon: kalem listesi + büyük toplam -->
        <section
          v-else-if="ekran === 'aktif' && adisyon"
          class="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 lg:gap-8 px-8 lg:px-12 pb-8 min-h-0"
        >
          <!-- Sol: Kalem listesi -->
          <div class="flex flex-col min-h-0">
            <div class="flex items-end justify-between mb-4">
              <div>
                <div class="text-[11px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-1 flex items-center gap-2">
                  <span class="status-dot-gold" />
                  {{ adisyon.masa?.ad || 'Sipariş' }}
                </div>
                <h2 class="text-3xl font-extralight text-pearl tracking-tight">Siparişiniz</h2>
              </div>
              <div class="text-right">
                <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">{{ adisyon.numara }}</div>
                <div class="text-xs text-pearl-60 tabular">{{ adisyonSuresi }}</div>
              </div>
            </div>

            <div class="flex-1 surface-elevated overflow-hidden relative">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright/60 to-transparent" />
              <div class="h-full overflow-y-auto p-5 lg:p-6 space-y-2">
                <TransitionGroup
                  enter-active-class="transition duration-400 ease-luxe"
                  enter-from-class="opacity-0 -translate-x-6"
                  move-class="transition duration-300"
                >
                  <div
                    v-for="k in tumKalemler"
                    :key="k.id"
                    :class="[
                      'flex items-center gap-4 py-3 px-3 rounded-xl border-b border-pearl-10 last:border-0 transition-colors',
                      sonKalemId === k.id && 'bg-gold-primary/8 border-gold-primary/30'
                    ]"
                  >
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-primary/20 to-gold-primary/8 border border-gold-primary/45 text-gold-dark text-xl font-bold flex items-center justify-center shrink-0 tabular shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_-2px_rgba(200,154,42,0.3)]">
                      {{ k.adet }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-lg font-medium text-pearl truncate">{{ k.urun.ad }}</div>
                      <div class="text-xs text-pearl-50 tabular">{{ paraFormat(k.birimFiyat) }} × {{ k.adet }}</div>
                    </div>
                    <div class="text-xl font-light gold-text tabular shrink-0">{{ paraFormat(k.toplam) }}</div>
                  </div>
                </TransitionGroup>

                <div v-if="!tumKalemler.length" class="text-center py-16 text-pearl-50">
                  <i class="fas fa-mug-hot text-5xl text-gold-primary/30 mb-4 block" />
                  <p class="text-sm">Sipariş bekleniyor…</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sağ: Toplam paneli -->
          <div class="flex flex-col gap-4">
            <div class="surface-elevated p-6 lg:p-8 relative overflow-hidden">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent" />
              <div class="absolute -top-12 -right-12 w-48 h-48 bg-gold-primary/8 rounded-full blur-2xl" />

              <div class="relative space-y-3">
                <div class="flex justify-between text-pearl-60">
                  <span class="text-sm">Ara Toplam</span>
                  <span class="tabular text-lg">{{ paraFormat(adisyon.araToplam) }}</span>
                </div>
                <div v-if="Number(adisyon.iskontoTutar) > 0" class="flex justify-between text-amber-700">
                  <span class="text-sm">İskonto</span>
                  <span class="tabular text-lg">− {{ paraFormat(adisyon.iskontoTutar) }}</span>
                </div>
                <div v-if="odenmis > 0" class="flex justify-between text-emerald-700">
                  <span class="text-sm">Ödenen</span>
                  <span class="tabular text-lg">− {{ paraFormat(odenmis) }}</span>
                </div>

                <div class="pt-4 border-t border-pearl-10">
                  <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">
                    {{ odenmis > 0 ? 'Kalan Bakiye' : 'Toplam' }}
                  </div>
                  <div class="text-6xl lg:text-7xl font-extralight gold-text-shimmer tabular leading-none">
                    {{ paraFormat(odenmis > 0 ? kalan : adisyon.toplamTutar) }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Bilgi kartı -->
            <div class="surface-elevated p-5 text-sm text-pearl-60 leading-relaxed flex items-start gap-3">
              <i class="fas fa-circle-info text-gold-primary mt-0.5 shrink-0" />
              <span>Siparişiniz hazırlanıyor. Ödemenizi kasamızda alabilirsiniz.</span>
            </div>
          </div>
        </section>

        <!-- ◇ Hızlı satış sepet ekranı -->
        <section
          v-else-if="ekran === 'sepet' && hizliSepet"
          class="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6 lg:gap-8 px-8 lg:px-12 pb-8 min-h-0"
        >
          <div class="flex flex-col min-h-0">
            <div class="flex items-end justify-between mb-4">
              <div>
                <div class="text-[11px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-1 flex items-center gap-2">
                  <span class="status-dot-gold" />
                  Hızlı Satış
                </div>
                <h2 class="text-3xl font-extralight text-pearl tracking-tight">Siparişiniz</h2>
              </div>
              <div class="text-right">
                <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Tezgah</div>
                <div class="text-xs text-pearl-60 tabular">{{ hizliSepet.kalemler.length }} kalem</div>
              </div>
            </div>

            <div class="flex-1 surface-elevated overflow-hidden relative">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright/60 to-transparent" />
              <div class="h-full overflow-y-auto p-5 lg:p-6 space-y-2">
                <TransitionGroup
                  enter-active-class="transition duration-400 ease-luxe"
                  enter-from-class="opacity-0 -translate-x-6"
                  move-class="transition duration-300"
                >
                  <div
                    v-for="(k, i) in hizliSepet.kalemler"
                    :key="`${k.ad}-${i}`"
                    class="flex items-center gap-4 py-3 px-3 rounded-xl border-b border-pearl-10 last:border-0"
                  >
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-primary/20 to-gold-primary/8 border border-gold-primary/45 text-gold-dark text-xl font-bold flex items-center justify-center shrink-0 tabular shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_-2px_rgba(200,154,42,0.3)]">
                      {{ k.adet }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-lg font-medium text-pearl truncate">{{ k.ad }}</div>
                      <div class="text-xs text-pearl-50 tabular">{{ paraFormat(k.birimFiyat) }} × {{ k.adet }}</div>
                    </div>
                    <div class="text-xl font-light gold-text tabular shrink-0">{{ paraFormat(k.toplam) }}</div>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <div class="surface-elevated p-6 lg:p-8 relative overflow-hidden">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent" />
              <div class="absolute -top-12 -right-12 w-48 h-48 bg-gold-primary/8 rounded-full blur-2xl" />
              <div class="relative">
                <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Toplam</div>
                <div class="text-6xl lg:text-7xl font-extralight gold-text-shimmer tabular leading-none">
                  {{ paraFormat(hizliSepet.toplam) }}
                </div>
              </div>
            </div>
            <div class="surface-elevated p-5 text-sm text-pearl-60 leading-relaxed flex items-start gap-3">
              <i class="fas fa-circle-info text-gold-primary mt-0.5 shrink-0" />
              <span>Siparişiniz hazırlanıyor. Ödeme için lütfen kasamıza geçin.</span>
            </div>
          </div>
        </section>

        <!-- ◇ Ödeme ekranı: masa + sipariş kalemleri (sol) + büyük tutar/alınan/para üstü (sağ) -->
        <section
          v-else-if="ekran === 'odeme' && odemeDurumu"
          class="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-6 lg:gap-8 px-8 lg:px-12 pb-8 min-h-0"
        >
          <!-- Sol: Masa bilgisi + kalem listesi (varsa) -->
          <div class="flex flex-col min-h-0">
            <div class="flex items-end justify-between mb-4">
              <div>
                <div class="text-[11px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-1 flex items-center gap-2">
                  <span class="status-dot-gold" />
                  Ödeme Alınıyor
                </div>
                <h2 class="text-3xl font-extralight text-pearl tracking-tight flex items-center gap-3">
                  <i class="fas fa-table text-gold-primary/60 text-2xl" v-if="odemeDurumu.masaAd" />
                  {{ odemeDurumu.masaAd || 'Sipariş' }}
                </h2>
              </div>
              <div class="text-right">
                <div v-if="odemeDurumu.adisyonNo" class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold tabular">{{ odemeDurumu.adisyonNo }}</div>
                <div class="text-xs text-pearl-60 tabular">{{ adisyonSuresi }}</div>
              </div>
            </div>

            <div class="flex-1 surface-elevated overflow-hidden relative">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright/60 to-transparent" />
              <div class="h-full overflow-y-auto p-5 lg:p-6 space-y-2">
                <template v-if="adisyon && tumKalemler.length">
                  <div
                    v-for="k in tumKalemler"
                    :key="k.id"
                    class="flex items-center gap-4 py-3 px-3 rounded-xl border-b border-pearl-10 last:border-0"
                  >
                    <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-primary/20 to-gold-primary/8 border border-gold-primary/45 text-gold-dark text-xl font-bold flex items-center justify-center shrink-0 tabular shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_2px_6px_-2px_rgba(200,154,42,0.3)]">
                      {{ k.adet }}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="text-lg font-medium text-pearl truncate">{{ k.urun.ad }}</div>
                      <div class="text-xs text-pearl-50 tabular">{{ paraFormat(k.birimFiyat) }} × {{ k.adet }}</div>
                    </div>
                    <div class="text-xl font-light gold-text tabular shrink-0">{{ paraFormat(k.toplam) }}</div>
                  </div>
                </template>
                <div v-else class="h-full flex flex-col items-center justify-center text-center text-pearl-50 py-12">
                  <i class="fas fa-receipt text-5xl text-gold-primary/30 mb-4 block" />
                  <p class="text-sm">Sipariş bekleniyor…</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Sağ: Ödeme widget'ı -->
          <div class="flex flex-col gap-4">
            <!-- Büyük ödenecek tutar -->
            <div class="surface-elevated p-7 lg:p-8 text-center relative overflow-hidden">
              <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent" />
              <div class="absolute -top-12 -right-12 w-48 h-48 bg-gold-primary/8 rounded-full blur-2xl" />
              <div class="relative">
                <div class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-3">
                  Ödenecek Tutar
                </div>
                <div class="text-5xl lg:text-6xl font-extralight gold-text-shimmer tabular leading-none mb-4">
                  {{ paraFormat(odemeDurumu.toplam) }}
                </div>
                <div v-if="odemeDurumu.tip" class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-br from-gold-primary/20 to-gold-primary/8 border border-gold-primary/45 text-gold-dark text-sm font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
                  <i :class="[
                    'fas',
                    odemeDurumu.tip === 'NAKIT' && 'fa-money-bill-wave',
                    odemeDurumu.tip === 'KREDI_KARTI' && 'fa-credit-card',
                    odemeDurumu.tip === 'TICKET' && 'fa-ticket',
                  ]" />
                  {{
                    odemeDurumu.tip === 'NAKIT' ? 'Nakit' :
                    odemeDurumu.tip === 'KREDI_KARTI' ? 'Kredi Kartı' :
                    odemeDurumu.tip === 'TICKET' ? 'Yemek Çeki' : odemeDurumu.tip
                  }}
                </div>
              </div>
            </div>

            <!-- Alınan + Para Üstü (nakitte) -->
            <Transition
              enter-active-class="transition duration-400 ease-luxe"
              leave-active-class="transition duration-200"
              enter-from-class="opacity-0 translate-y-4"
              leave-to-class="opacity-0 translate-y-4"
            >
              <div v-if="odemeDurumu.tip === 'NAKIT' && odemeDurumu.alinan > 0" class="grid grid-cols-2 gap-3">
                <div class="surface-elevated p-5 text-center">
                  <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Alınan</div>
                  <div class="text-2xl lg:text-3xl font-light text-pearl tabular">{{ paraFormat(odemeDurumu.alinan) }}</div>
                </div>
                <div
                  :class="[
                    'surface-elevated p-5 text-center relative overflow-hidden border-2 transition-all',
                    odemeDurumu.paraUstu > 0
                      ? 'border-emerald-500/50 bg-emerald-500/12 shadow-[0_6px_20px_-8px_rgba(16,185,129,0.35)]'
                      : 'border-pearl-10'
                  ]"
                >
                  <div v-if="odemeDurumu.paraUstu > 0" class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
                  <div :class="['text-[10px] uppercase tracking-extra-wide font-semibold mb-2', odemeDurumu.paraUstu > 0 ? 'text-emerald-700' : 'text-pearl-50']">
                    Para Üstü
                  </div>
                  <div :class="['text-2xl lg:text-3xl font-light tabular', odemeDurumu.paraUstu > 0 ? 'text-emerald-700' : 'text-pearl-40']">
                    {{ paraFormat(odemeDurumu.paraUstu) }}
                  </div>
                </div>
              </div>
            </Transition>

            <div class="surface-elevated p-4 text-xs text-pearl-60 leading-relaxed flex items-start gap-2.5 mt-auto">
              <i class="fas fa-circle-info text-gold-primary mt-0.5 shrink-0" />
              <span>Lütfen kasiyerimizden ödemenizi tamamlamasını bekleyin.</span>
            </div>
          </div>
        </section>

        <!-- ◇ Kart işlemi: POS terminalinde işlem -->
        <section
          v-else-if="ekran === 'kart' && kartIslemi"
          class="flex-1 flex items-center justify-center px-8 lg:px-16 pb-12"
        >
          <div class="text-center max-w-2xl animate-slide-up">
            <div class="relative inline-flex items-center justify-center w-44 h-44 mb-8">
              <!-- POS cihazı görseli -->
              <div class="absolute inset-2 rounded-[2rem] bg-gradient-to-br from-gold-primary/25 to-gold-primary/8 border border-gold-primary/50 flex items-center justify-center shadow-[0_12px_40px_-12px_rgba(200,154,42,0.5),inset_0_1px_0_rgba(255,255,255,0.6)]">
                <i class="fas fa-credit-card text-6xl text-gold-primary drop-shadow-[0_2px_8px_rgba(200,154,42,0.5)]" />
              </div>
              <!-- Yaklaşan kart -->
              <div class="absolute -top-4 -right-4 w-20 h-12 rounded-lg bg-gradient-to-br from-gold-bright to-gold-primary border border-gold-dark/40 animate-float shadow-[0_8px_20px_-4px_rgba(200,154,42,0.55)]">
                <div class="absolute top-2 left-2 right-2 h-3 rounded-sm bg-pearl/20" />
              </div>
              <!-- NFC dalgaları -->
              <div class="absolute inset-0 rounded-[2.25rem] border-2 border-gold-primary/70 animate-ping" />
              <div class="absolute -inset-3 rounded-[2.5rem] border-2 border-gold-primary/40 animate-pulse-gold" />
              <div class="absolute -inset-6 rounded-[2.75rem] border border-gold-primary/20 animate-pulse-gold" />
            </div>

            <div class="text-[11px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-3 flex items-center justify-center gap-2">
              <span class="status-dot-gold" />
              POS Terminal İşliyor
            </div>
            <h2 class="text-4xl lg:text-5xl font-extralight text-pearl tracking-tight mb-4">
              Kartınızı Yaklaştırın
            </h2>
            <div class="text-6xl lg:text-7xl font-extralight gold-text-shimmer tabular leading-none mb-6">
              {{ paraFormat(kartIslemi.tutar) }}
            </div>
            <p class="text-pearl-60 max-w-md mx-auto leading-relaxed">
              Lütfen kartınızı POS cihazına yaklaştırın veya takın. Banka onayı bekleniyor.
            </p>
          </div>
        </section>

        <!-- ◇ Teşekkür ekranı -->
        <section
          v-else-if="ekran === 'tesekkur'"
          class="flex-1 flex items-center justify-center px-8 lg:px-16 pb-12"
        >
          <div class="text-center animate-slide-up">
            <div class="relative inline-flex items-center justify-center w-40 h-40 mb-10">
              <div class="absolute inset-0 rounded-full border-2 border-emerald-500/50 animate-ping" />
              <div class="absolute inset-2 rounded-full border border-emerald-500/55" />
              <div class="absolute inset-4 bg-gradient-to-br from-emerald-500/35 to-emerald-500/15 rounded-full border border-emerald-500/40 shadow-[0_10px_30px_-8px_rgba(16,185,129,0.45)]" />
              <i class="fas fa-check text-6xl text-emerald-700 relative z-10 drop-shadow-[0_2px_6px_rgba(16,185,129,0.4)]" />
            </div>

            <div class="text-[11px] uppercase tracking-extra-wide text-emerald-700 font-semibold mb-3">
              Ödeme Tamamlandı
            </div>
            <h1 class="text-6xl lg:text-7xl font-extralight gold-text-shimmer tracking-tight mb-6">
              Teşekkürler
            </h1>
            <div class="flex items-center justify-center gap-3 text-sm uppercase tracking-extra-wide text-pearl-50 mb-8">
              <span class="w-16 h-px bg-gradient-to-r from-transparent to-gold-primary/40" />
              <span>Yine Bekleriz</span>
              <span class="w-16 h-px bg-gradient-to-l from-transparent to-gold-primary/40" />
            </div>

            <p class="text-pearl-60 max-w-md mx-auto leading-relaxed">
              Tercih ettiğiniz için teşekkür ederiz. İyi günler dileriz.
            </p>
          </div>
        </section>
      </Transition>
    </main>
  </div>
</template>
