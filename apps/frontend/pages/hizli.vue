<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface Urun {
  id: string;
  ad: string;
  fiyat: string | number;
  kategoriId?: string | null;
  resimUrl?: string | null;
  aktif: boolean;
}

interface Kategori { id: string; ad: string; renk?: string | null; ikon?: string | null }

const sube = useSubeStore();
const urunler = ref<Urun[]>([]);
const kategoriler = ref<Kategori[]>([]);
const aktifKategori = ref('');
const arama = ref('');
const yukleniyor = ref(false);

const sepet = ref<Array<{ urun: Urun; adet: number }>>([]);
const sepetMobilAcik = ref(false);
const musteri = useMusteriEkran();

async function yukle() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const [u, k] = await Promise.all([
      apiFetch<Urun[]>(`/urunler?subeId=${sube.aktifSubeId}`),
      apiFetch<Kategori[]>(`/kategoriler?subeId=${sube.aktifSubeId}`),
    ]);
    urunler.value = u.filter((x) => x.aktif);
    kategoriler.value = k;
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => yukle(), { immediate: true });

const filtreli = computed(() => {
  let l = urunler.value;
  if (aktifKategori.value) l = l.filter((u) => u.kategoriId === aktifKategori.value);
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    l = l.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q));
  }
  return l;
});

function sepeteEkle(u: Urun) {
  const v = sepet.value.find((s) => s.urun.id === u.id);
  if (v) v.adet++;
  else sepet.value.push({ urun: u, adet: 1 });
}

function sepetAzalt(i: number) {
  if (sepet.value[i].adet > 1) sepet.value[i].adet--;
  else sepet.value.splice(i, 1);
}

const toplam = computed(() => sepet.value.reduce((s, x) => s + Number(x.urun.fiyat) * x.adet, 0));

// Müşteri ekranı: sepet değiştikçe yayınla
watch(
  [sepet, toplam],
  () => {
    if (sepet.value.length) {
      musteri.sepetYaz({
        kalemler: sepet.value.map((s) => ({
          ad: s.urun.ad,
          adet: s.adet,
          birimFiyat: Number(s.urun.fiyat),
          toplam: Number(s.urun.fiyat) * s.adet,
        })),
        toplam: toplam.value,
      });
    } else {
      musteri.sepetTemizle();
    }
  },
  { deep: true },
);

// Müşteri ekranı yeni açılırsa "şu anki state'i yeniden yaz" ister.
// Hızlı satış sepeti aktifse broadcast'i tekrar yapıyoruz.
let yenilemeAbone: (() => void) | null = null;
onMounted(() => {
  yenilemeAbone = musteri.yenilemeIsteklerineCevapla(() => {
    if (sepet.value.length) {
      musteri.sepetYaz({
        kalemler: sepet.value.map((s) => ({
          ad: s.urun.ad,
          adet: s.adet,
          birimFiyat: Number(s.urun.fiyat),
          toplam: Number(s.urun.fiyat) * s.adet,
        })),
        toplam: toplam.value,
      });
    }
    if (odemeModalAcik.value) {
      musteri.odemeDurumuYaz({
        toplam: toplam.value,
        alinan: odenenTutar.value,
        paraUstu: paraUstu.value,
        tip: secilenTip.value,
        mod: 'TAM',
      });
    }
  });
});

onUnmounted(() => {
  musteri.sepetTemizle();
  musteri.odemeDurumuTemizle();
  yenilemeAbone?.();
});

// Ödeme akışı
const odemeModalAcik = ref(false);
const secilenTip = ref<string>('NAKIT');
const odenenTutar = ref(0);

const odemeTipleri = [
  { tip: 'NAKIT', ad: 'Nakit', ikon: 'fa-money-bill-wave', renk: 'emerald' },
  { tip: 'KREDI_KARTI', ad: 'Kredi Kartı', ikon: 'fa-credit-card', renk: 'blue' },
];

function odemeAc(tip: string) {
  if (!sepet.value.length) return;
  secilenTip.value = tip;
  odenenTutar.value = Number(toplam.value.toFixed(2));
  odemeModalAcik.value = true;
  musteri.odemeDurumuYaz({
    toplam: toplam.value,
    alinan: odenenTutar.value,
    paraUstu: 0,
    tip,
    mod: 'TAM',
  });
}

const paraUstu = computed(() => Math.max(0, odenenTutar.value - toplam.value));

// Müşteri ekranı: ödeme modal açıkken alınan/para üstü canlı güncelle
watch([odenenTutar, paraUstu, secilenTip, odemeModalAcik], () => {
  if (odemeModalAcik.value) {
    musteri.odemeDurumuYaz({
      toplam: toplam.value,
      alinan: odenenTutar.value,
      paraUstu: paraUstu.value,
      tip: secilenTip.value,
      mod: 'TAM',
    });
  } else {
    musteri.odemeDurumuTemizle();
  }
});

const islemde = ref(false);
const fis = ref<{ numara: string; toplam: number; tip: string; odenen: number; paraUstu: number; tarih: string; kart?: any } | null>(null);

// Kart işlem state
interface KartYaniti {
  basarili: boolean;
  slipNo?: string;
  rrn?: string;
  banka?: string;
  sonRakam?: string;
  onayKod?: string;
  terminalMarka?: string;
  hata?: string;
}
const kartDurumu = ref<'beklemede' | 'cekiliyor' | 'basarili' | 'red'>('beklemede');
const kartTutar = ref(0);
const kartYanit = ref<KartYaniti | null>(null);
const kartHata = ref('');

/**
 * Atomik kart ödemesi: backend validate → POS çek → Odeme kaydı tek istekte.
 * POS başarılı ama DB başarısız olursa backend otomatik iade çağırır.
 */
async function kartlaOdeAtomik(
  adisyonId: string,
  tutar: number,
  referans: string,
  idempotencyKey: string,
): Promise<KartYaniti> {
  kartTutar.value = tutar;
  kartDurumu.value = 'cekiliyor';
  kartHata.value = '';
  kartYanit.value = null;
  musteri.kartIslemiYaz({ durum: 'cekiliyor', tutar });
  try {
    const sonuc = await apiFetch<{ odeme: { id: string }; kartMeta: KartYaniti }>(
      '/odemeler/kartla-ode',
      { method: 'POST', body: { adisyonId, tutar, referans, idempotencyKey } },
    );
    kartYanit.value = sonuc.kartMeta;
    kartDurumu.value = 'basarili';
    musteri.kartIslemiYaz({
      durum: 'basarili',
      tutar,
      slipNo: sonuc.kartMeta.slipNo,
      banka: sonuc.kartMeta.banka,
      sonRakam: sonuc.kartMeta.sonRakam,
    });
    await new Promise((r) => setTimeout(r, 600));
    return sonuc.kartMeta;
  } catch (e: any) {
    kartDurumu.value = 'red';
    kartHata.value = e?.data?.message || 'Kart işlemi reddedildi';
    musteri.kartIslemiYaz({ durum: 'red', tutar, hata: kartHata.value });
    throw e;
  }
}
function kartOverlayKapat() {
  kartDurumu.value = 'beklemede';
  kartYanit.value = null;
  kartHata.value = '';
  musteri.kartIslemiTemizle();
}

async function satisTamamla() {
  if (!sube.aktifSubeId || islemde.value) return;
  islemde.value = true;
  // NOT: Akış 3 ayrı endpoint (adisyon → sipariş → ödeme). Şimdilik yalnız
  // ödeme adımı idempotent — diğer iki adım için tek transactional endpoint
  // sonraki iterasyonda gelecek (DURUM.md sertleştirme listesi).
  const odemeKey =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  try {
    // 1) Adisyon aç (masasız)
    const adisyon = await apiFetch<{ id: string; numara: string }>('/adisyonlar', {
      method: 'POST',
      body: { subeId: sube.aktifSubeId, not: 'Hızlı satış' },
    });
    // 2) Sipariş ekle
    await apiFetch('/siparisler', {
      method: 'POST',
      body: {
        adisyonId: adisyon.id,
        kalemler: sepet.value.map((s) => ({ urunId: s.urun.id, adet: s.adet })),
      },
    });

    // 3) Ödeme: kart için atomik akış (POS+DB tek istekte), nakit/diğer için klasik
    let kartMeta: KartYaniti | null = null;
    if (secilenTip.value === 'KREDI_KARTI') {
      kartMeta = await kartlaOdeAtomik(
        adisyon.id,
        Number(toplam.value.toFixed(2)),
        adisyon.numara,
        odemeKey,
      );
      kartOverlayKapat();
    } else {
      await apiFetch('/odemeler', {
        method: 'POST',
        body: {
          adisyonId: adisyon.id,
          tip: secilenTip.value,
          tutar: Number(toplam.value.toFixed(2)),
          idempotencyKey: odemeKey,
        },
      });
    }

    fis.value = {
      numara: adisyon.numara,
      toplam: toplam.value,
      tip: secilenTip.value,
      odenen: odenenTutar.value,
      paraUstu: paraUstu.value,
      tarih: new Date().toLocaleString('tr-TR'),
      kart: kartMeta,
    };
    sepet.value = [];
    odemeModalAcik.value = false;
    musteri.tesekkurGoster(6);
    musteri.sepetTemizle();
    musteri.odemeDurumuTemizle();
  } catch (e: any) {
    if (kartDurumu.value !== 'red') {
      useToastStore().hata(e?.data?.message || 'Satış tamamlanamadı');
    }
  } finally {
    islemde.value = false;
  }
}

// Hızlı tutar butonları (nakit için)
const hizliTutarlar = [50, 100, 200, 500];

function fisYazdir() {
  if (import.meta.client) window.print();
}
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-0">
    <!-- SOL: Ürün Grid -->
    <section class="lg:col-span-7 xl:col-span-8 space-y-4">
      <PageHeader baslik="Hızlı Sipariş" aciklama="Tezgah satışı — masa olmadan" ikon="fa-bolt" />

      <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">Önce bir şube seç</div>

      <template v-else>
        <div class="relative">
          <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
          <input v-model="arama" class="input-base pl-11" placeholder="Ürün ara veya barkod oku..." autofocus />
        </div>

        <div class="-mx-4 sm:-mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-visible">
          <div class="flex sm:flex-wrap gap-2 pb-1 sm:pb-0 min-w-min">
            <button
              @click="aktifKategori = ''"
              :class="['shrink-0 px-3 py-1.5 rounded-xl text-xs transition border whitespace-nowrap', aktifKategori === '' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-pearl-10 text-pearl-60']"
            >Tümü</button>
            <button
              v-for="k in kategoriler"
              :key="k.id"
              @click="aktifKategori = k.id"
              :class="['shrink-0 px-3 py-1.5 rounded-xl text-xs transition border flex items-center gap-1.5 whitespace-nowrap', aktifKategori === k.id ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-pearl-10 text-pearl-60']"
            >
              <span v-if="k.renk" class="w-1.5 h-1.5 rounded-full" :style="{ background: k.renk }" />
              {{ k.ad }}
            </button>
          </div>
        </div>

        <div v-if="yukleniyor && !urunler.length" class="text-center py-12">
          <i class="fas fa-spinner fa-spin text-2xl text-pearl-60" />
        </div>

        <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          <button
            v-for="u in filtreli"
            :key="u.id"
            @click="sepeteEkle(u)"
            class="glass-card p-3 text-left hover:scale-[1.03] hover:border-gold-primary/40 transition active:scale-100"
          >
            <div class="font-semibold leading-snug mb-2 line-clamp-2 min-h-[2.5rem] text-sm sm:text-base">{{ u.ad }}</div>
            <div class="text-base font-bold gold-text tabular">{{ paraFormat(u.fiyat) }}</div>
          </button>
        </div>
      </template>
    </section>

    <!-- SAĞ: Sepet + Ödeme -->
    <!-- Mobilde sticky alt bar olarak gösterilir, desktop'ta sağ panel -->
    <aside class="hidden lg:block lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-24">
      <div class="glass-card p-5">
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-pearl-10">
          <h3 class="font-semibold gold-text">
            <i class="fas fa-cart-shopping mr-2" />Sepet
          </h3>
          <button v-if="sepet.length" @click="sepet = []" class="text-xs text-pearl-50 hover:text-red-300">
            Temizle
          </button>
        </div>

        <div v-if="!sepet.length" class="text-center py-8 text-pearl-50 text-sm">
          <i class="fas fa-utensils text-3xl text-gold-primary/30 mb-3 block" />
          Ürün seçerek başla
        </div>

        <div v-else class="space-y-2 max-h-72 overflow-y-auto mb-4">
          <div v-for="(s, i) in sepet" :key="i" class="flex items-center gap-2">
            <div class="flex items-center bg-ink-300 rounded-lg overflow-hidden">
              <button @click="sepetAzalt(i)" class="w-7 h-7 hover:bg-pearl-10 text-gold-primary">−</button>
              <span class="w-8 text-center text-sm font-bold tabular">{{ s.adet }}</span>
              <button @click="s.adet++" class="w-7 h-7 hover:bg-pearl-10 text-gold-primary">+</button>
            </div>
            <div class="flex-1 text-sm truncate">{{ s.urun.ad }}</div>
            <div class="text-sm font-medium tabular">{{ paraFormat(Number(s.urun.fiyat) * s.adet) }}</div>
          </div>
        </div>

        <div class="pt-3 border-t border-pearl-10 flex items-end justify-between">
          <span class="text-sm text-pearl-60">Toplam</span>
          <span class="text-3xl font-light gold-text tabular">{{ paraFormat(toplam) }}</span>
        </div>
      </div>

      <!-- Ödeme Tipi Butonları (desktop) -->
      <div v-if="sepet.length" class="grid grid-cols-2 gap-2">
        <button
          v-for="o in odemeTipleri"
          :key="o.tip"
          @click="odemeAc(o.tip)"
          :class="['glass-card p-4 hover:border-gold-primary/40 transition text-left', `hover:bg-${o.renk}-500/5`]"
        >
          <i :class="['fas', o.ikon, 'text-xl mb-1.5 block', `text-${o.renk}-300`]" />
          <div class="text-sm font-medium">{{ o.ad }}</div>
        </button>
      </div>
    </aside>

    <!-- MOBİL ALT SEPET BARI -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      leave-active-class="transition duration-150 ease-in"
      enter-from-class="opacity-0 translate-y-full"
      leave-to-class="opacity-0 translate-y-full"
    >
      <div
        v-if="sepet.length"
        class="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-ink-200/95 backdrop-blur-xl border-t border-pearl-10 px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] flex items-center gap-3"
      >
        <button
          @click="sepetMobilAcik = true"
          class="flex items-center gap-2 min-w-0 flex-1"
        >
          <div class="relative w-11 h-11 rounded-xl bg-gold-soft border border-gold-primary/30 text-gold-primary flex items-center justify-center shrink-0">
            <i class="fas fa-cart-shopping" />
            <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gold-primary text-ink-100 text-[10px] font-bold flex items-center justify-center tabular">
              {{ sepet.reduce((s, x) => s + x.adet, 0) }}
            </span>
          </div>
          <div class="text-left min-w-0">
            <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold leading-none">Sepet</div>
            <div class="text-lg font-light gold-text tabular leading-tight">{{ paraFormat(toplam) }}</div>
          </div>
        </button>
        <button
          @click="sepetMobilAcik = true"
          class="btn-gold !py-2.5 !text-sm !px-5 shrink-0"
        >
          <i class="fas fa-credit-card mr-2" />Öde
        </button>
      </div>
    </Transition>
  </div>

  <!-- MOBİL SEPET DRAWER -->
  <AppModal :acik="sepetMobilAcik" baslik="Sepet" genislik="max-w-md" @kapat="sepetMobilAcik = false">
    <div v-if="!sepet.length" class="text-center py-8 text-pearl-50 text-sm">
      <i class="fas fa-utensils text-3xl text-gold-primary/30 mb-3 block" />
      Ürün seçerek başla
    </div>
    <div v-else>
      <div class="space-y-2 max-h-72 overflow-y-auto mb-4 -mx-2 px-2">
        <div v-for="(s, i) in sepet" :key="i" class="flex items-center gap-2 py-2 border-b border-pearl-10 last:border-0">
          <div class="flex items-center bg-ink-300 rounded-lg overflow-hidden">
            <button @click="sepetAzalt(i)" class="w-8 h-8 hover:bg-pearl-10 text-gold-primary text-lg">−</button>
            <span class="w-9 text-center text-sm font-bold tabular">{{ s.adet }}</span>
            <button @click="s.adet++" class="w-8 h-8 hover:bg-pearl-10 text-gold-primary text-lg">+</button>
          </div>
          <div class="flex-1 text-sm truncate">{{ s.urun.ad }}</div>
          <div class="text-sm font-medium tabular">{{ paraFormat(Number(s.urun.fiyat) * s.adet) }}</div>
        </div>
      </div>
      <div class="pt-3 border-t border-pearl-10 flex items-end justify-between mb-4">
        <span class="text-sm text-pearl-60">Toplam</span>
        <span class="text-3xl font-light gold-text tabular">{{ paraFormat(toplam) }}</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="o in odemeTipleri"
          :key="o.tip"
          @click="sepetMobilAcik = false; odemeAc(o.tip)"
          :class="['glass-card p-3.5 hover:border-gold-primary/40 transition text-left']"
        >
          <i :class="['fas', o.ikon, 'text-xl mb-1.5 block', `text-${o.renk}-300`]" />
          <div class="text-sm font-medium">{{ o.ad }}</div>
        </button>
      </div>
    </div>
  </AppModal>

  <!-- Ödeme Modal -->
  <AppModal :acik="odemeModalAcik" baslik="Ödeme Al" genislik="max-w-md" @kapat="odemeModalAcik = false">
    <div class="space-y-5">
      <div class="text-center pb-4 border-b border-pearl-10">
        <div class="text-xs text-pearl-50 uppercase tracking-extra-wide font-semibold">Toplam</div>
        <div class="text-4xl font-light gold-text mt-1 tabular">{{ paraFormat(toplam) }}</div>
        <div class="text-xs text-pearl-60 mt-1">
          <i :class="['fas', odemeTipleri.find(o => o.tip === secilenTip)?.ikon, 'mr-1.5']" />
          {{ odemeTipleri.find(o => o.tip === secilenTip)?.ad }}
        </div>
      </div>

      <div v-if="secilenTip === 'NAKIT'">
        <label class="block text-sm text-pearl-60 mb-2">Verilen Tutar</label>
        <input v-model.number="odenenTutar" type="number" min="0" step="0.01" class="input-base text-2xl font-bold text-center tabular" />
        <div class="grid grid-cols-4 gap-2 mt-2">
          <button
            v-for="t in hizliTutarlar"
            :key="t"
            type="button"
            @click="odenenTutar = t"
            class="glass-card py-2 text-xs hover:bg-glass-hover transition tabular"
          >
            ₺{{ t }}
          </button>
        </div>
        <div v-if="paraUstu > 0" class="mt-4 glass-card p-4 bg-emerald-500/5 border-emerald-500/30 text-center">
          <div class="text-xs text-pearl-60 uppercase tracking-extra-wide font-semibold">Para Üstü</div>
          <div class="text-3xl font-light text-emerald-300 mt-1 tabular">{{ paraFormat(paraUstu) }}</div>
        </div>
      </div>

      <div class="flex gap-3 pt-2">
        <button @click="odemeModalAcik = false" class="btn-ghost flex-1">
          İptal
        </button>
        <button @click="satisTamamla" :disabled="islemde || odenenTutar < toplam" class="btn-gold flex-1">
          <i v-if="islemde" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          {{ islemde ? 'İşleniyor...' : 'Tamamla' }}
        </button>
      </div>
    </div>
  </AppModal>

  <!-- KART İŞLEM OVERLAY (POS terminali) -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-300 ease-luxe"
      leave-active-class="transition duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="kartDurumu !== 'beklemede'"
        class="fixed inset-0 z-[68] bg-pearl-60 backdrop-blur-md flex items-center justify-center p-4"
      >
        <div class="glass-card max-w-md w-full p-8 text-center relative overflow-hidden">
          <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright to-transparent" />
          <div v-if="kartDurumu === 'cekiliyor'">
            <div class="relative w-32 h-32 mx-auto mb-6">
              <div class="absolute inset-0 rounded-3xl bg-gradient-to-br from-ink-300 to-ink-200 border border-gold-primary/30 flex items-center justify-center">
                <i class="fas fa-credit-card text-5xl text-gold-primary" />
              </div>
              <div class="absolute -top-3 -right-3 w-12 h-8 rounded-md bg-gradient-to-br from-pearl-30 to-pearl-10 border border-pearl-40 animate-float shadow-lg" />
              <div class="absolute inset-0 rounded-3xl border-2 border-gold-primary/40 animate-ping" />
              <div class="absolute -inset-2 rounded-[1.75rem] border border-gold-primary/20 animate-pulse-gold" />
            </div>
            <div class="text-[11px] uppercase tracking-extra-wide text-gold-bright font-semibold mb-2">POS Terminal İşliyor</div>
            <h3 class="text-xl font-light text-pearl mb-2">Kartı POS cihazına yaklaştırın</h3>
            <div class="text-3xl font-extralight gold-text-shimmer tabular mb-6">{{ paraFormat(kartTutar) }}</div>
            <div class="flex items-center justify-center gap-2 text-xs text-pearl-50">
              <i class="fas fa-spinner fa-spin text-gold-primary/60" />
              <span>Banka onayı bekleniyor…</span>
            </div>
          </div>

          <div v-else-if="kartDurumu === 'basarili' && kartYanit">
            <div class="relative w-20 h-20 mx-auto mb-5">
              <div class="absolute inset-0 rounded-full bg-emerald-500/15 border-2 border-emerald-400 flex items-center justify-center">
                <i class="fas fa-check text-3xl text-emerald-300" />
              </div>
              <div class="absolute inset-0 rounded-full border-2 border-emerald-400/40 animate-ping" />
            </div>
            <div class="text-[10px] uppercase tracking-extra-wide text-emerald-300/80 font-semibold mb-2">Onaylandı</div>
            <div class="text-2xl font-light gold-text mb-4 tabular">{{ paraFormat(kartTutar) }}</div>
            <div class="text-xs text-pearl-60 space-y-1">
              <div v-if="kartYanit.banka" class="flex justify-between gap-3 pb-1 border-b border-pearl-10">
                <span class="text-pearl-50">Banka</span>
                <span class="text-pearl-80 font-medium">{{ kartYanit.banka }}</span>
              </div>
              <div v-if="kartYanit.sonRakam" class="flex justify-between gap-3 pb-1 border-b border-pearl-10">
                <span class="text-pearl-50">Kart</span>
                <span class="text-pearl-80 font-mono tabular">•••• {{ kartYanit.sonRakam }}</span>
              </div>
              <div v-if="kartYanit.slipNo" class="flex justify-between gap-3 pb-1 border-b border-pearl-10">
                <span class="text-pearl-50">Slip No</span>
                <span class="text-gold-primary font-mono tabular">{{ kartYanit.slipNo }}</span>
              </div>
            </div>
          </div>

          <div v-else-if="kartDurumu === 'red'">
            <div class="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-400 flex items-center justify-center mx-auto mb-5">
              <i class="fas fa-times text-3xl text-red-300" />
            </div>
            <div class="text-[10px] uppercase tracking-extra-wide text-red-300/80 font-semibold mb-2">İşlem Reddedildi</div>
            <h3 class="text-xl font-light text-pearl mb-2">Kart Kabul Edilmedi</h3>
            <div class="text-2xl font-light gold-text tabular mb-3">{{ paraFormat(kartTutar) }}</div>
            <p class="text-sm text-pearl-60 mb-5">{{ kartHata || 'POS terminali işlemi reddetti.' }}</p>
            <div class="flex gap-3">
              <button @click="kartOverlayKapat(); satisTamamla()" class="btn-gold flex-1">
                <i class="fas fa-rotate-right mr-2" />Tekrar Dene
              </button>
              <button @click="kartOverlayKapat" class="btn-ghost flex-1">İptal</button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Fiş Modal -->
  <AppModal :acik="!!fis" baslik="Satış Tamamlandı" genislik="max-w-sm" @kapat="fis = null">
    <div v-if="fis" class="space-y-4 text-center">
      <div class="text-6xl text-emerald-400">
        <i class="fas fa-circle-check" />
      </div>
      <div class="text-xs text-pearl-50 uppercase tracking-extra-wide font-semibold">{{ fis.numara }}</div>
      <div class="text-3xl font-light gold-text tabular">{{ paraFormat(fis.toplam) }}</div>

      <div class="glass-card p-4 text-sm text-left space-y-1.5">
        <div class="flex justify-between">
          <span class="text-pearl-60">Ödeme Tipi</span>
          <span>{{ odemeTipleri.find(o => o.tip === fis.tip)?.ad }}</span>
        </div>
        <div v-if="fis.tip === 'NAKIT'" class="flex justify-between">
          <span class="text-pearl-60">Verilen</span>
          <span class="tabular">{{ paraFormat(fis.odenen) }}</span>
        </div>
        <div v-if="fis.tip === 'NAKIT' && fis.paraUstu > 0" class="flex justify-between text-emerald-300">
          <span>Para Üstü</span>
          <span class="font-bold tabular">{{ paraFormat(fis.paraUstu) }}</span>
        </div>
        <template v-if="fis.kart">
          <div v-if="fis.kart.banka" class="flex justify-between text-pearl-70">
            <span>Banka</span>
            <span class="font-medium">{{ fis.kart.banka }}</span>
          </div>
          <div v-if="fis.kart.sonRakam" class="flex justify-between text-pearl-70">
            <span>Kart</span>
            <span class="font-mono tabular">•••• {{ fis.kart.sonRakam }}</span>
          </div>
          <div v-if="fis.kart.slipNo" class="flex justify-between text-gold-primary">
            <span>Slip No</span>
            <span class="font-mono tabular">{{ fis.kart.slipNo }}</span>
          </div>
        </template>
        <div class="flex justify-between text-xs text-pearl-50 pt-2 border-t border-pearl-10">
          <span class="tabular">{{ fis.tarih }}</span>
        </div>
      </div>

      <div class="flex gap-2">
        <button @click="fisYazdir" class="btn-ghost flex-1">
          <i class="fas fa-print mr-2" /> Yazdır
        </button>
        <button @click="fis = null" class="btn-gold flex-1">
          <i class="fas fa-plus mr-2" /> Yeni Satış
        </button>
      </div>
    </div>
  </AppModal>
</template>

<style scoped>
@media print {
  /* Yazdırma için: tüm sayfayı gizle, sadece fiş kalsın */
}
</style>
