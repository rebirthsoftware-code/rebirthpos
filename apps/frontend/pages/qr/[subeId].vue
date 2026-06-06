<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ layout: false });

interface Urun {
  id: string;
  ad: string;
  aciklama?: string | null;
  fiyat: string | number;
  resimUrl?: string | null;
  kategoriId?: string | null;
}

interface Kategori {
  id: string;
  ad: string;
  renk?: string | null;
  ikon?: string | null;
}

interface Menu {
  sube: { id: string; ad: string; firma: { ad: string; logoUrl?: string | null; paraBirimi: string } };
  kategoriler: Kategori[];
  urunler: Urun[];
}

interface HesapKalem { ad: string; adet: number; birimFiyat: number; toplam: number }
interface Hesap {
  bos: boolean;
  masa: { id: string; ad: string };
  sube: { id: string; ad: string };
  firma: { ad: string; paraBirimi: string };
  adisyonId?: string;
  numara?: string;
  durum?: string;
  kalemler?: HesapKalem[];
  araToplam?: number;
  kdvTutar?: number;
  toplamTutar?: number;
  odenenTutar?: number;
  kalanTutar?: number;
}

const route = useRoute();
const router = useRouter();
const subeId = route.params.subeId as string;
const masaId = (route.query.masa as string) || '';

const menu = ref<Menu | null>(null);
const masaAd = ref<string>('');
const yukleniyor = ref(true);
const hata = ref('');
const aktifKategori = ref<string>('');
const arama = ref('');
const sepetAcik = ref(false);

const sepet = ref<Array<{ urun: Urun; adet: number; not: string }>>([]);
const musteriAd = ref('');
const musteriTel = ref('');
const siparisNot = ref('');

// Görünüm: 'menu' (sipariş) | 'hesap' (masadan ödeme). Masa varsa hesap sekmesi açılır.
const gorunum = ref<'menu' | 'hesap'>('menu');

async function yukle() {
  yukleniyor.value = true;
  hata.value = '';
  try {
    const config = useRuntimeConfig();
    menu.value = await $fetch<Menu>('/qr/menu', {
      baseURL: config.public.apiBase,
      query: { subeId },
    });
    if (masaId) {
      try {
        const m = await $fetch<{ ad: string }>(`/qr/masa/${masaId}`, {
          baseURL: config.public.apiBase,
        });
        masaAd.value = m.ad;
      } catch {}
    }
  } catch (e: any) {
    hata.value = e?.data?.message || 'Menü yüklenemedi';
  } finally {
    yukleniyor.value = false;
  }
}

onMounted(() => {
  yukle();
  // Ödeme sayfasından dönüş — sonuç bildir, URL'i temizle
  const sonuc = route.query.odeme as string | undefined;
  if (sonuc === 'basarili') {
    odemeSonucMesaji.value = { basarili: true, metin: 'Ödemeniz başarıyla alındı. Teşekkürler!' };
    gorunum.value = 'hesap';
    hesapYukle();
  } else if (sonuc === 'basarisiz') {
    odemeSonucMesaji.value = { basarili: false, metin: 'Ödeme tamamlanamadı. Tekrar deneyebilirsiniz.' };
    gorunum.value = 'hesap';
  }
  if (sonuc) router.replace({ query: { ...route.query, odeme: undefined } });
});

const filtreli = computed(() => {
  if (!menu.value) return [];
  let liste = menu.value.urunler;
  if (aktifKategori.value) liste = liste.filter((u) => u.kategoriId === aktifKategori.value);
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    liste = liste.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q));
  }
  return liste;
});

const sayilar = computed(() => {
  if (!menu.value) return { '': 0 };
  const m: Record<string, number> = { '': menu.value.urunler.length };
  for (const u of menu.value.urunler) {
    if (u.kategoriId) m[u.kategoriId] = (m[u.kategoriId] || 0) + 1;
  }
  return m;
});

function sepeteEkle(u: Urun) {
  const v = sepet.value.find((s) => s.urun.id === u.id);
  if (v) v.adet++;
  else sepet.value.push({ urun: u, adet: 1, not: '' });
}

function sepetAzalt(idx: number) {
  if (sepet.value[idx].adet > 1) sepet.value[idx].adet--;
  else sepet.value.splice(idx, 1);
}

const sepetAdet = computed(() => sepet.value.reduce((a, s) => a + s.adet, 0));
const sepetToplam = computed(() => sepet.value.reduce((a, s) => a + Number(s.urun.fiyat) * s.adet, 0));

const gonderiliyor = ref(false);
const basariMesaji = ref<{ numara: string; toplam: number } | null>(null);

async function siparisGonder() {
  if (!sepet.value.length) return;
  gonderiliyor.value = true;
  try {
    const config = useRuntimeConfig();
    const yanit = await $fetch<{ numara: string; toplam: number }>('/qr/siparis', {
      baseURL: config.public.apiBase,
      method: 'POST',
      body: {
        subeId,
        masaId: masaId || undefined,
        musteriAd: musteriAd.value.trim() || undefined,
        musteriTel: musteriTel.value.trim() || undefined,
        not: siparisNot.value.trim() || undefined,
        kalemler: sepet.value.map((s) => ({
          urunId: s.urun.id,
          adet: s.adet,
          not: s.not || undefined,
        })),
      },
    });
    basariMesaji.value = yanit;
    sepet.value = [];
    sepetAcik.value = false;
    // Sipariş sonrası masa hesabı değişir
    if (masaId) hesapYukle();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Sipariş gönderilemedi');
  } finally {
    gonderiliyor.value = false;
  }
}

// ───────────────────────── MASADAN ÖDEME (PayTR Sanal POS) ─────────────────────────

const hesap = ref<Hesap | null>(null);
const hesapYukleniyor = ref(false);
const odemeSonucMesaji = ref<{ basarili: boolean; metin: string } | null>(null);

// Ödeme formu
const odemeAcik = ref(false);
const odemeAd = ref('');
const odemeEposta = ref('');
const odemeBaslatiliyor = ref(false);

async function hesapYukle() {
  if (!masaId) return;
  hesapYukleniyor.value = true;
  try {
    const config = useRuntimeConfig();
    hesap.value = await $fetch<Hesap>(`/qr/masa/${masaId}/hesap`, {
      baseURL: config.public.apiBase,
    });
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hesap yüklenemedi');
  } finally {
    hesapYukleniyor.value = false;
  }
}

function hesabaGec() {
  gorunum.value = 'hesap';
  if (!hesap.value) hesapYukle();
}

async function odemeyiBaslat() {
  if (!hesap.value?.adisyonId || !hesap.value.kalanTutar) return;
  odemeBaslatiliyor.value = true;
  try {
    const config = useRuntimeConfig();
    const yanit = await $fetch<{ token: string; saglayici: string; testMod: string | null; odemeUrl: string | null; tutar: number }>(
      '/qr/odeme/baslat',
      {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: {
          subeId,
          adisyonId: hesap.value.adisyonId,
          tutar: hesap.value.kalanTutar,
          musteriAd: odemeAd.value.trim() || undefined,
          musteriEposta: odemeEposta.value.trim() || undefined,
        },
      },
    );

    // Gerçek PayTR ise iframe URL'i döner → oraya git. MOCK ise kendi test sayfamız.
    if (yanit.odemeUrl) {
      window.location.href = yanit.odemeUrl;
      return;
    }
    await navigateTo({
      path: '/qr/odeme-test',
      query: {
        token: yanit.token,
        subeId,
        masa: masaId,
        adisyonId: hesap.value.adisyonId,
        tutar: String(yanit.tutar),
        ad: odemeAd.value.trim() || undefined,
        firma: hesap.value.firma.ad,
        sube: hesap.value.sube.ad,
        masaAd: hesap.value.masa.ad,
        testMod: yanit.testMod || undefined,
        saglayici: yanit.saglayici,
      },
    });
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Ödeme başlatılamadı');
  } finally {
    odemeBaslatiliyor.value = false;
  }
}
</script>

<template>
  <Html lang="tr">
    <Head>
      <Title>{{ menu?.sube.firma.ad || 'Menü' }} · {{ menu?.sube.ad || '' }}</Title>
    </Head>
  </Html>

  <div class="min-h-screen pb-32">
    <div v-if="yukleniyor" class="min-h-screen flex items-center justify-center">
      <i class="fas fa-spinner fa-spin text-4xl text-gold-primary" />
    </div>

    <div v-else-if="hata" class="min-h-screen flex items-center justify-center p-6">
      <div class="glass-card p-8 text-center max-w-sm">
        <i class="fas fa-circle-exclamation text-4xl text-red-400 mb-4 block" />
        <p class="text-red-300">{{ hata }}</p>
      </div>
    </div>

    <template v-else-if="menu">
      <!-- Sipariş başarı modali -->
      <Transition
        enter-active-class="transition duration-300"
        leave-active-class="transition duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="basariMesaji" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div class="glass-card p-8 max-w-sm w-full text-center">
            <div class="text-6xl text-emerald-400 mb-4">
              <i class="fas fa-circle-check" />
            </div>
            <h2 class="text-xl font-bold gold-text mb-2">Siparişiniz Alındı!</h2>
            <p class="text-pearl-60 text-sm mb-4">Birazdan hazırlanıp masanıza gelecek.</p>
            <div class="text-xs text-pearl-50 mb-1">Sipariş No</div>
            <div class="text-2xl font-bold gold-text mb-6">{{ basariMesaji.numara }}</div>
            <button @click="basariMesaji = null" class="btn-gold !w-full">Devam Et</button>
          </div>
        </div>
      </Transition>

      <!-- Ödeme sonuç modali -->
      <Transition
        enter-active-class="transition duration-300"
        leave-active-class="transition duration-200"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="odemeSonucMesaji" class="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
          <div class="glass-card p-8 max-w-sm w-full text-center">
            <div :class="['text-6xl mb-4', odemeSonucMesaji.basarili ? 'text-emerald-400' : 'text-red-400']">
              <i :class="['fas', odemeSonucMesaji.basarili ? 'fa-circle-check' : 'fa-circle-xmark']" />
            </div>
            <h2 class="text-xl font-bold gold-text mb-2">
              {{ odemeSonucMesaji.basarili ? 'Ödeme Başarılı' : 'Ödeme Başarısız' }}
            </h2>
            <p class="text-pearl-60 text-sm mb-6">{{ odemeSonucMesaji.metin }}</p>
            <button @click="odemeSonucMesaji = null" class="btn-gold !w-full">Tamam</button>
          </div>
        </div>
      </Transition>

      <!-- Sepet drawer -->
      <Transition
        enter-active-class="transition duration-300"
        leave-active-class="transition duration-200"
        enter-from-class="translate-y-full"
        leave-to-class="translate-y-full"
      >
        <div
          v-if="sepetAcik"
          class="fixed inset-0 bg-black/70 z-40 flex items-end"
          @click.self="sepetAcik = false"
        >
          <div class="bg-bg-dark border-t border-glass-border w-full max-h-[85vh] rounded-t-3xl overflow-hidden flex flex-col">
            <div class="p-5 border-b border-glass-border flex items-center justify-between">
              <h3 class="text-lg font-semibold gold-text">
                <i class="fas fa-cart-shopping mr-2" />Sepetin
              </h3>
              <button @click="sepetAcik = false" class="text-pearl-60 hover:text-gold-primary text-xl">
                <i class="fas fa-times" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-5 space-y-3">
              <div v-if="!sepet.length" class="text-center py-10 text-pearl-50">
                <i class="fas fa-cart-shopping text-3xl text-gold-primary/30 mb-3 block" />
                Sepet boş
              </div>

              <div v-for="(s, i) in sepet" :key="i" class="flex items-center gap-3 glass-card p-3">
                <div class="flex-1 min-w-0">
                  <div class="font-medium leading-tight">{{ s.urun.ad }}</div>
                  <div class="text-xs text-pearl-50">{{ paraFormat(s.urun.fiyat) }}</div>
                </div>
                <div class="flex items-center bg-bg-dark/50 rounded-lg overflow-hidden">
                  <button @click="sepetAzalt(i)" class="w-8 h-8 hover:bg-glass-hover text-gold-primary">−</button>
                  <span class="w-8 text-center font-bold">{{ s.adet }}</span>
                  <button @click="s.adet++" class="w-8 h-8 hover:bg-glass-hover text-gold-primary">+</button>
                </div>
                <div class="font-bold gold-text w-20 text-right text-sm">
                  {{ paraFormat(Number(s.urun.fiyat) * s.adet) }}
                </div>
              </div>

              <div v-if="!masaId && sepet.length" class="space-y-3 pt-3 border-t border-glass-border">
                <div class="text-xs text-pearl-60 uppercase tracking-wider">İletişim (Paket için)</div>
                <input v-model="musteriAd" class="input-base" placeholder="Ad Soyad" />
                <input v-model="musteriTel" class="input-base" placeholder="Telefon" />
              </div>

              <div v-if="sepet.length">
                <textarea
                  v-model="siparisNot"
                  rows="2"
                  class="input-base resize-none"
                  placeholder="Sipariş notunuz (opsiyonel)"
                />
              </div>
            </div>

            <div v-if="sepet.length" class="p-5 border-t border-glass-border bg-bg-dark/80">
              <div class="flex items-center justify-between mb-4">
                <span class="text-pearl-60">Toplam</span>
                <span class="text-2xl font-bold gold-text">{{ paraFormat(sepetToplam) }}</span>
              </div>
              <button @click="siparisGonder" :disabled="gonderiliyor" class="btn-gold w-full">
                <i v-if="gonderiliyor" class="fas fa-spinner fa-spin mr-2" />
                <i v-else class="fas fa-paper-plane mr-2" />
                {{ gonderiliyor ? 'Gönderiliyor...' : 'Siparişi Gönder' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- Üst Başlık -->
      <header class="sticky top-0 z-30 bg-bg-dark/95 backdrop-blur-xl border-b border-glass-border px-4 py-4">
        <div class="max-w-3xl mx-auto flex items-center gap-4">
          <img v-if="menu.sube.firma.logoUrl" :src="menu.sube.firma.logoUrl" class="w-12 h-12 rounded-xl object-cover" />
          <div v-else class="w-12 h-12 rounded-xl bg-gold-primary/15 flex items-center justify-center text-gold-primary text-xl">
            <i class="fas fa-utensils" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold leading-tight gold-text truncate">{{ menu.sube.firma.ad }}</div>
            <div class="text-xs text-pearl-60 truncate">
              {{ menu.sube.ad }}
              <span v-if="masaAd" class="text-gold-primary ml-1">· {{ masaAd }}</span>
            </div>
          </div>
        </div>

        <!-- Menü / Hesap sekmesi — sadece masadan girişte -->
        <div v-if="masaId" class="max-w-3xl mx-auto mt-3 grid grid-cols-2 gap-1 p-1 rounded-2xl bg-bg-dark/60 border border-glass-border">
          <button
            @click="gorunum = 'menu'"
            :class="['py-2 rounded-xl text-sm font-medium transition', gorunum === 'menu' ? 'bg-gold-gradient text-bg-dark' : 'text-pearl-60']"
          >
            <i class="fas fa-utensils mr-1.5" />Menü
          </button>
          <button
            @click="hesabaGec"
            :class="['py-2 rounded-xl text-sm font-medium transition', gorunum === 'hesap' ? 'bg-gold-gradient text-bg-dark' : 'text-pearl-60']"
          >
            <i class="fas fa-receipt mr-1.5" />Hesabım / Öde
          </button>
        </div>
      </header>

      <!-- ─────────────── MENÜ GÖRÜNÜMÜ ─────────────── -->
      <div v-show="gorunum === 'menu'" class="max-w-3xl mx-auto p-4 space-y-5">
        <!-- Arama -->
        <div class="relative">
          <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
          <input v-model="arama" class="input-base pl-11" placeholder="Ürün ara..." />
        </div>

        <!-- Kategoriler -->
        <div class="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2">
          <button
            @click="aktifKategori = ''"
            :class="['px-4 py-2 rounded-xl text-sm whitespace-nowrap transition border', aktifKategori === '' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
          >
            Tümü
            <span class="ml-1.5 text-xs opacity-70">{{ sayilar[''] }}</span>
          </button>
          <button
            v-for="k in menu.kategoriler"
            :key="k.id"
            @click="aktifKategori = k.id"
            :class="['px-4 py-2 rounded-xl text-sm whitespace-nowrap transition border flex items-center gap-2', aktifKategori === k.id ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
          >
            <i v-if="k.ikon" :class="['fas', k.ikon]" :style="{ color: k.renk || undefined }" />
            {{ k.ad }}
            <span class="text-xs opacity-70">{{ sayilar[k.id] || 0 }}</span>
          </button>
        </div>

        <!-- Ürünler -->
        <div v-if="!filtreli.length" class="glass-card p-8 text-center text-pearl-50">
          <i class="fas fa-utensils text-3xl text-gold-primary/30 mb-3 block" />
          Ürün bulunamadı
        </div>

        <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <article
            v-for="u in filtreli"
            :key="u.id"
            class="glass-card overflow-hidden flex hover:border-gold-primary/40 transition"
          >
            <div
              v-if="u.resimUrl"
              class="w-28 h-28 bg-cover bg-center shrink-0"
              :style="{ backgroundImage: `url('${u.resimUrl}')` }"
            />
            <div v-else class="w-28 h-28 bg-bg-dark/50 flex items-center justify-center text-3xl text-gold-primary/30 shrink-0">
              <i class="fas fa-utensils" />
            </div>
            <div class="flex-1 p-3 flex flex-col">
              <h3 class="font-semibold leading-tight">{{ u.ad }}</h3>
              <p v-if="u.aciklama" class="text-xs text-pearl-50 mt-1 line-clamp-2">{{ u.aciklama }}</p>
              <div class="mt-auto flex items-end justify-between pt-2">
                <span class="text-lg font-bold gold-text">{{ paraFormat(u.fiyat) }}</span>
                <button
                  @click="sepeteEkle(u)"
                  class="w-9 h-9 rounded-xl bg-gold-gradient text-bg-dark font-bold hover:scale-110 active:scale-95 transition"
                >
                  <i class="fas fa-plus" />
                </button>
              </div>
            </div>
          </article>
        </div>
      </div>

      <!-- ─────────────── HESAP / ÖDEME GÖRÜNÜMÜ ─────────────── -->
      <div v-show="gorunum === 'hesap' && masaId" class="max-w-3xl mx-auto p-4 space-y-4">
        <div v-if="hesapYukleniyor" class="glass-card p-10 text-center">
          <i class="fas fa-spinner fa-spin text-3xl text-gold-primary" />
        </div>

        <template v-else-if="hesap">
          <!-- Açık hesap yok -->
          <div v-if="hesap.bos" class="glass-card p-8 text-center text-pearl-50">
            <i class="fas fa-receipt text-3xl text-gold-primary/30 mb-3 block" />
            <p class="mb-1 text-pearl-70">Bu masada henüz açık hesap yok.</p>
            <p class="text-sm">Menüden sipariş verdiğinizde hesabınız burada görünecek.</p>
          </div>

          <template v-else>
            <!-- Hesap dökümü -->
            <div class="glass-card overflow-hidden">
              <div class="p-4 border-b border-glass-border flex items-center justify-between">
                <div>
                  <div class="text-xs text-pearl-50 uppercase tracking-wider">Hesap No</div>
                  <div class="font-bold gold-text">{{ hesap.numara }}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs text-pearl-50 uppercase tracking-wider">Masa</div>
                  <div class="font-semibold">{{ hesap.masa.ad }}</div>
                </div>
              </div>

              <div class="p-4 space-y-2">
                <div v-for="(k, i) in hesap.kalemler" :key="i" class="flex items-center gap-3 text-sm">
                  <span class="w-7 h-7 shrink-0 rounded-lg bg-bg-dark/50 flex items-center justify-center text-gold-primary text-xs font-bold">
                    {{ k.adet }}
                  </span>
                  <span class="flex-1 min-w-0 truncate">{{ k.ad }}</span>
                  <span class="text-pearl-60 text-xs">{{ paraFormat(k.birimFiyat) }}</span>
                  <span class="font-semibold w-20 text-right">{{ paraFormat(k.toplam) }}</span>
                </div>
              </div>

              <div class="p-4 border-t border-glass-border space-y-1.5 text-sm">
                <div class="flex justify-between text-pearl-60">
                  <span>Ara Toplam</span><span>{{ paraFormat(hesap.araToplam) }}</span>
                </div>
                <div class="flex justify-between text-pearl-60">
                  <span>KDV</span><span>{{ paraFormat(hesap.kdvTutar) }}</span>
                </div>
                <div class="flex justify-between font-bold text-base pt-1">
                  <span>Toplam</span><span class="gold-text">{{ paraFormat(hesap.toplamTutar) }}</span>
                </div>
                <div v-if="(hesap.odenenTutar || 0) > 0" class="flex justify-between text-emerald-400 text-xs">
                  <span>Ödenen</span><span>− {{ paraFormat(hesap.odenenTutar) }}</span>
                </div>
                <div class="flex justify-between font-bold text-lg pt-1 border-t border-glass-border mt-1">
                  <span>Kalan</span><span class="gold-text">{{ paraFormat(hesap.kalanTutar) }}</span>
                </div>
              </div>
            </div>

            <!-- Ödeme kutusu -->
            <div v-if="(hesap.kalanTutar || 0) > 0" class="glass-card p-4 space-y-3">
              <div class="flex items-center gap-2 text-sm text-pearl-70">
                <i class="fas fa-lock text-gold-primary" />
                <span>Güvenli online ödeme — <b class="text-pearl-90">PayTR Sanal POS</b></span>
              </div>
              <button @click="odemeAcik = !odemeAcik" v-if="!odemeAcik" class="btn-gold w-full">
                <i class="fas fa-credit-card mr-2" />Kartla Öde · {{ paraFormat(hesap.kalanTutar) }}
              </button>

              <div v-if="odemeAcik" class="space-y-3">
                <input v-model="odemeAd" class="input-base" placeholder="Ad Soyad (fiş için, opsiyonel)" />
                <input v-model="odemeEposta" type="email" class="input-base" placeholder="E-posta (fiş için, opsiyonel)" />
                <button @click="odemeyiBaslat" :disabled="odemeBaslatiliyor" class="btn-gold w-full">
                  <i v-if="odemeBaslatiliyor" class="fas fa-spinner fa-spin mr-2" />
                  <i v-else class="fas fa-credit-card mr-2" />
                  {{ odemeBaslatiliyor ? 'Yönlendiriliyor...' : `${paraFormat(hesap.kalanTutar)} Öde` }}
                </button>
                <p class="text-[11px] text-pearl-50 text-center">
                  Ödeme güvenli sayfada tamamlanır. Kart bilgileriniz işletme ile paylaşılmaz.
                </p>
              </div>
            </div>

            <div v-else class="glass-card p-6 text-center text-emerald-400">
              <i class="fas fa-circle-check text-3xl mb-2 block" />
              <p class="font-semibold">Hesabınız tamamen ödendi. Teşekkürler!</p>
            </div>

            <button @click="hesapYukle" class="w-full text-sm text-pearl-60 hover:text-gold-primary py-2">
              <i class="fas fa-rotate mr-1.5" />Hesabı Yenile
            </button>
          </template>
        </template>
      </div>

      <!-- Alt Sepet Butonu — sadece menü görünümünde -->
      <Transition
        enter-active-class="transition duration-200"
        leave-active-class="transition duration-200"
        enter-from-class="translate-y-full opacity-0"
        leave-to-class="translate-y-full opacity-0"
      >
        <div v-if="sepet.length && gorunum === 'menu'" class="fixed bottom-0 left-0 right-0 p-4 z-30 pointer-events-none">
          <div class="max-w-3xl mx-auto pointer-events-auto">
            <button
              @click="sepetAcik = true"
              class="w-full bg-gold-gradient text-bg-dark py-4 rounded-2xl font-semibold shadow-glass hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-between px-5"
            >
              <span class="flex items-center gap-3">
                <span class="w-9 h-9 rounded-xl bg-bg-dark/20 flex items-center justify-center font-bold">
                  {{ sepetAdet }}
                </span>
                Sepeti Görüntüle
              </span>
              <span class="text-lg">{{ paraFormat(sepetToplam) }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
