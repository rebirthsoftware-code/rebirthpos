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

// Gerçek kategori filtresi: '' (vitrin) ve '_tum' (tüm menü) seçili değil demektir.
function gercekKategoriMi(id: string): boolean {
  return !!id && id !== '_tum';
}
const filtreli = computed(() => {
  if (!menu.value) return [];
  let liste = menu.value.urunler;
  if (gercekKategoriMi(aktifKategori.value)) liste = liste.filter((u) => u.kategoriId === aktifKategori.value);
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    liste = liste.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q));
  }
  return liste;
});

// Ürün listesi başlığı (kategori adı / arama / tüm menü)
const aktifBaslik = computed<{ ad: string; ikon?: string | null; renk?: string | null }>(() => {
  if (arama.value.trim()) return { ad: 'Arama Sonuçları', ikon: 'fa-magnifying-glass', renk: null };
  if (gercekKategoriMi(aktifKategori.value)) {
    const k = kategoriMap.value.get(aktifKategori.value);
    return { ad: k?.ad || '', ikon: k?.ikon, renk: k?.renk };
  }
  return { ad: 'Tüm Menü', ikon: 'fa-layer-group', renk: null };
});

const sayilar = computed(() => {
  if (!menu.value) return { '': 0 };
  const m: Record<string, number> = { '': menu.value.urunler.length };
  for (const u of menu.value.urunler) {
    if (u.kategoriId) m[u.kategoriId] = (m[u.kategoriId] || 0) + 1;
  }
  return m;
});

// Kategori meta (renk/ikon) — ürün kartı placeholder'ı ve rozetler için.
const kategoriMap = computed(() => {
  const m = new Map<string, Kategori>();
  if (menu.value) for (const k of menu.value.kategoriler) m.set(k.id, k);
  return m;
});
function urunKat(u: Urun): Kategori | undefined {
  return u.kategoriId ? kategoriMap.value.get(u.kategoriId) : undefined;
}
function urunRenk(u: Urun): string {
  return urunKat(u)?.renk || '#c89a2a';
}
function urunIkon(u: Urun): string {
  return urunKat(u)?.ikon || 'fa-utensils';
}
function sepetAdetUrun(id: string): number {
  return sepet.value.find((s) => s.urun.id === id)?.adet || 0;
}

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

  <div class="min-h-screen pb-36 bg-mesh-luxe">
    <!-- Yükleniyor -->
    <div v-if="yukleniyor" class="min-h-screen flex flex-col items-center justify-center gap-4">
      <div class="w-16 h-16 rounded-2xl bg-gold-gradient shadow-gold-glow flex items-center justify-center animate-pulse-gold">
        <i class="fas fa-utensils text-2xl text-white" />
      </div>
      <i class="fas fa-spinner fa-spin text-xl text-gold-primary" />
    </div>

    <!-- Hata -->
    <div v-else-if="hata" class="min-h-screen flex items-center justify-center p-6">
      <div class="surface-elevated p-8 text-center max-w-sm shadow-elevated">
        <i class="fas fa-circle-exclamation text-4xl text-red-400 mb-4 block" />
        <p class="text-red-500 font-medium">{{ hata }}</p>
      </div>
    </div>

    <template v-else-if="menu">
      <!-- ═══════ Sipariş başarı modali ═══════ -->
      <Transition
        enter-active-class="transition duration-300" leave-active-class="transition duration-200"
        enter-from-class="opacity-0" leave-to-class="opacity-0"
      >
        <div v-if="basariMesaji" class="fixed inset-0 bg-pearl-60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div class="surface-elevated p-8 max-w-sm w-full text-center shadow-elevated animate-slide-up">
            <div class="w-20 h-20 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center text-5xl text-emerald-500 mb-5">
              <i class="fas fa-circle-check" />
            </div>
            <h2 class="text-xl font-bold gold-text mb-2">Siparişiniz Alındı</h2>
            <p class="text-pearl-60 text-sm mb-5">Birazdan özenle hazırlanıp masanıza gelecek.</p>
            <div class="rounded-2xl bg-gold-soft border border-gold-primary/20 py-3 mb-6">
              <div class="text-[10px] uppercase tracking-[0.2em] text-gold-dark/70 mb-1">Sipariş No</div>
              <div class="text-2xl font-bold gold-text">{{ basariMesaji.numara }}</div>
            </div>
            <button @click="basariMesaji = null" class="btn-gold">Devam Et</button>
          </div>
        </div>
      </Transition>

      <!-- ═══════ Ödeme sonuç modali ═══════ -->
      <Transition
        enter-active-class="transition duration-300" leave-active-class="transition duration-200"
        enter-from-class="opacity-0" leave-to-class="opacity-0"
      >
        <div v-if="odemeSonucMesaji" class="fixed inset-0 bg-pearl-60 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div class="surface-elevated p-8 max-w-sm w-full text-center shadow-elevated animate-slide-up">
            <div :class="['w-20 h-20 mx-auto rounded-full flex items-center justify-center text-5xl mb-5', odemeSonucMesaji.basarili ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500']">
              <i :class="['fas', odemeSonucMesaji.basarili ? 'fa-circle-check' : 'fa-circle-xmark']" />
            </div>
            <h2 class="text-xl font-bold gold-text mb-2">
              {{ odemeSonucMesaji.basarili ? 'Ödeme Başarılı' : 'Ödeme Başarısız' }}
            </h2>
            <p class="text-pearl-60 text-sm mb-6">{{ odemeSonucMesaji.metin }}</p>
            <button @click="odemeSonucMesaji = null" class="btn-gold">Tamam</button>
          </div>
        </div>
      </Transition>

      <!-- ═══════ Sepet drawer ═══════ -->
      <Transition
        enter-active-class="transition duration-300" leave-active-class="transition duration-200"
        enter-from-class="translate-y-full" leave-to-class="translate-y-full"
      >
        <div v-if="sepetAcik" class="fixed inset-0 bg-pearl-60 backdrop-blur-sm z-40 flex items-end" @click.self="sepetAcik = false">
          <div class="bg-white w-full max-h-[88vh] rounded-t-[28px] overflow-hidden flex flex-col shadow-soft-up">
            <div class="p-3 flex justify-center"><span class="w-12 h-1.5 rounded-full bg-pearl-20" /></div>
            <div class="px-5 pb-4 border-b border-pearl-10 flex items-center justify-between">
              <h3 class="text-lg font-bold text-pearl flex items-center gap-2">
                <i class="fas fa-bag-shopping text-gold-primary" />Sepetiniz
                <span class="badge-gold">{{ sepetAdet }}</span>
              </h3>
              <button @click="sepetAcik = false" class="w-9 h-9 rounded-full bg-pearl-5 text-pearl-60 hover:text-gold-primary">
                <i class="fas fa-times" />
              </button>
            </div>

            <div class="flex-1 overflow-y-auto p-4 space-y-2.5">
              <div v-if="!sepet.length" class="text-center py-12 text-pearl-50">
                <i class="fas fa-bag-shopping text-4xl text-gold-primary/25 mb-3 block" />
                Sepetiniz boş
              </div>

              <div v-for="(s, i) in sepet" :key="i" class="flex items-center gap-3 bg-ink-100 rounded-2xl p-2.5">
                <div
                  class="w-14 h-14 rounded-xl bg-cover bg-center shrink-0 flex items-center justify-center"
                  :style="s.urun.resimUrl ? { backgroundImage: `url('${s.urun.resimUrl}')` } : { background: `linear-gradient(140deg, ${urunRenk(s.urun)}22, ${urunRenk(s.urun)}0a)` }"
                >
                  <i v-if="!s.urun.resimUrl" :class="['fas', urunIkon(s.urun)]" :style="{ color: urunRenk(s.urun) }" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="font-semibold text-sm leading-tight text-pearl truncate">{{ s.urun.ad }}</div>
                  <div class="text-xs text-gold-dark font-medium mt-0.5">{{ paraFormat(s.urun.fiyat) }}</div>
                </div>
                <div class="flex items-center bg-white border border-pearl-10 rounded-full overflow-hidden shadow-sm">
                  <button @click="sepetAzalt(i)" class="w-8 h-8 text-gold-primary hover:bg-gold-soft">−</button>
                  <span class="w-7 text-center font-bold text-sm text-pearl">{{ s.adet }}</span>
                  <button @click="s.adet++" class="w-8 h-8 text-gold-primary hover:bg-gold-soft">+</button>
                </div>
              </div>

              <div v-if="!masaId && sepet.length" class="space-y-2.5 pt-3 border-t border-pearl-10">
                <div class="text-[11px] text-pearl-60 uppercase tracking-widest font-semibold">İletişim (Paket için)</div>
                <input v-model="musteriAd" class="input-base" placeholder="Ad Soyad" />
                <input v-model="musteriTel" class="input-base" placeholder="Telefon" />
              </div>

              <div v-if="sepet.length">
                <textarea v-model="siparisNot" rows="2" class="input-base resize-none" placeholder="Sipariş notunuz (opsiyonel)" />
              </div>
            </div>

            <div v-if="sepet.length" class="p-5 border-t border-pearl-10 bg-white">
              <div class="flex items-center justify-between mb-4">
                <span class="text-pearl-60">Toplam</span>
                <span class="text-2xl font-bold gold-text">{{ paraFormat(sepetToplam) }}</span>
              </div>
              <button @click="siparisGonder" :disabled="gonderiliyor" class="btn-gold">
                <i v-if="gonderiliyor" class="fas fa-spinner fa-spin mr-2" />
                <i v-else class="fas fa-paper-plane mr-2" />
                {{ gonderiliyor ? 'Gönderiliyor...' : 'Siparişi Gönder' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>

      <!-- ═══════ Üst Başlık (premium) ═══════ -->
      <header class="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-pearl-10 shadow-glass">
        <div class="max-w-3xl mx-auto px-4 pt-5 pb-4">
          <div class="flex items-center gap-4">
            <div class="relative shrink-0">
              <img v-if="menu.sube.firma.logoUrl" :src="menu.sube.firma.logoUrl" class="w-14 h-14 rounded-2xl object-cover ring-2 ring-gold-primary/30" />
              <div v-else class="w-14 h-14 rounded-2xl bg-gold-gradient shadow-gold-glow flex items-center justify-center text-2xl text-white">
                <i class="fas fa-utensils" />
              </div>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-[10px] uppercase tracking-[0.25em] text-gold-dark/70 font-semibold mb-0.5">Dijital Menü</div>
              <h1 class="text-xl font-bold gold-text leading-tight truncate">{{ menu.sube.firma.ad }}</h1>
              <div class="text-xs text-pearl-50 mt-1 flex items-center gap-2 flex-wrap">
                <span class="flex items-center gap-1"><i class="fas fa-location-dot text-gold-primary/70" />{{ menu.sube.ad }}</span>
                <span v-if="masaAd" class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-gold-soft border border-gold-primary/20 text-gold-dark text-[11px] font-semibold">
                  <i class="fas fa-chair" />{{ masaAd }}
                </span>
              </div>
            </div>
          </div>

          <!-- Menü / Hesap sekmesi — sadece masadan girişte -->
          <div v-if="masaId" class="mt-4 grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-ink-100 border border-pearl-10">
            <button
              @click="gorunum = 'menu'"
              :class="['py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2', gorunum === 'menu' ? 'bg-gold-gradient text-white shadow-gold-edge' : 'text-pearl-60']"
            >
              <i class="fas fa-utensils" />Menü
            </button>
            <button
              @click="hesabaGec"
              :class="['py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2', gorunum === 'hesap' ? 'bg-gold-gradient text-white shadow-gold-edge' : 'text-pearl-60']"
            >
              <i class="fas fa-receipt" />Hesabım / Öde
            </button>
          </div>
        </div>
      </header>

      <!-- ═══════════════ MENÜ GÖRÜNÜMÜ ═══════════════ -->
      <div v-show="gorunum === 'menu'" class="max-w-3xl mx-auto px-4 pt-5 space-y-5">
        <!-- Arama -->
        <div class="relative">
          <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gold-primary/60" />
          <input v-model="arama" class="input-base pl-11 !rounded-2xl !bg-white" placeholder="Lezzet ara..." />
        </div>

        <!-- ═══ KATEGORİ VİTRİNİ — önce kategoriler görünür ═══ -->
        <template v-if="aktifKategori === '' && !arama.trim()">
          <div class="flex items-center gap-2">
            <h2 class="text-[11px] uppercase tracking-[0.2em] text-gold-dark/70 font-semibold">Kategoriler</h2>
            <span class="h-px flex-1 bg-gold-line" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <button
              v-for="k in menu.kategoriler"
              :key="k.id"
              @click="aktifKategori = k.id"
              class="group relative surface-elevated overflow-hidden p-4 text-left hover:shadow-elevated hover:-translate-y-1 hover:border-gold-primary/30 transition-all duration-300"
            >
              <div class="absolute -right-5 -bottom-5 w-20 h-20 rounded-full opacity-[0.10] group-hover:opacity-20 transition" :style="{ background: k.renk || '#c89a2a' }" />
              <div class="relative">
                <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-3" :style="{ background: `${k.renk || '#c89a2a'}1f`, color: k.renk || '#c89a2a' }">
                  <i :class="['fas', k.ikon || 'fa-utensils']" />
                </div>
                <h3 class="font-bold text-pearl leading-tight">{{ k.ad }}</h3>
                <p class="text-xs text-pearl-50 mt-0.5">{{ sayilar[k.id] || 0 }} ürün</p>
              </div>
              <i class="fas fa-arrow-right absolute top-4 right-4 text-pearl-30 group-hover:text-gold-primary group-hover:translate-x-0.5 transition" />
            </button>
          </div>
          <button @click="aktifKategori = '_tum'" class="w-full text-center text-sm text-gold-dark font-semibold py-2.5 rounded-2xl bg-gold-soft border border-gold-primary/20 hover:bg-gold-primary/15 transition">
            <i class="fas fa-layer-group mr-1.5" />Tüm Menüyü Gör
          </button>
        </template>

        <!-- ═══ ÜRÜNLER — kategori seçili / tüm menü / arama ═══ -->
        <template v-else>
          <!-- Üst bar: geri + aktif başlık -->
          <div class="flex items-center gap-2">
            <button @click="aktifKategori = ''; arama = ''" class="flex items-center gap-1.5 text-sm font-semibold text-gold-dark hover:text-gold-primary shrink-0">
              <i class="fas fa-chevron-left" />Kategoriler
            </button>
            <span class="h-px flex-1 bg-gold-line" />
            <span class="text-sm font-bold text-pearl flex items-center gap-1.5">
              <i v-if="aktifBaslik.ikon" :class="['fas', aktifBaslik.ikon]" :style="{ color: aktifBaslik.renk || undefined }" />
              {{ aktifBaslik.ad }}
            </span>
          </div>

          <!-- Hızlı kategori geçişi -->
          <div class="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1 scrollbar-thin">
            <button
              @click="aktifKategori = '_tum'"
              :class="['px-4 py-2 rounded-2xl text-sm whitespace-nowrap transition-all border font-medium flex items-center gap-2 shrink-0', aktifKategori === '_tum' && !arama.trim() ? 'bg-gold-gradient text-white border-transparent shadow-gold-edge' : 'bg-white border-pearl-10 text-pearl-70']"
            >
              <i class="fas fa-layer-group text-xs" />Tümü
            </button>
            <button
              v-for="k in menu.kategoriler"
              :key="k.id"
              @click="aktifKategori = k.id; arama = ''"
              :class="['px-4 py-2 rounded-2xl text-sm whitespace-nowrap transition-all border font-medium flex items-center gap-2 shrink-0', aktifKategori === k.id && !arama.trim() ? 'bg-gold-gradient text-white border-transparent shadow-gold-edge' : 'bg-white border-pearl-10 text-pearl-70']"
            >
              <i v-if="k.ikon" :class="['fas', k.ikon, 'text-xs']" :style="aktifKategori === k.id && !arama.trim() ? {} : { color: k.renk || undefined }" />
              {{ k.ad }}
              <span class="text-xs opacity-80">{{ sayilar[k.id] || 0 }}</span>
            </button>
          </div>

          <!-- Boş durum -->
          <div v-if="!filtreli.length" class="surface-elevated p-10 text-center text-pearl-50">
            <i class="fas fa-utensils text-4xl text-gold-primary/25 mb-3 block" />
            Ürün bulunamadı
          </div>

          <div v-else class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <article
              v-for="u in filtreli"
              :key="u.id"
              class="group relative bg-white border border-pearl-10 rounded-2xl overflow-hidden shadow-glass hover:shadow-elevated hover:border-gold-primary/30 transition-all duration-300 hover:-translate-y-1 flex flex-col"
            >
            <!-- Görsel / placeholder -->
            <div class="relative aspect-square overflow-hidden">
              <img
                v-if="u.resimUrl"
                :src="u.resimUrl"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div
                v-else
                class="w-full h-full relative overflow-hidden"
                :style="{ background: `linear-gradient(140deg, ${urunRenk(u)}26 0%, ${urunRenk(u)}0d 55%, rgba(255,255,255,0) 100%)` }"
              >
                <i :class="['fas', urunIkon(u)]" class="absolute -right-3 -bottom-3 text-7xl opacity-[0.08]" :style="{ color: urunRenk(u) }" />
                <div class="absolute inset-0 flex items-center justify-center">
                  <i :class="['fas', urunIkon(u)]" class="text-3xl opacity-50" :style="{ color: urunRenk(u) }" />
                </div>
              </div>
              <!-- adet rozeti (sepetteyse) -->
              <Transition enter-active-class="transition duration-200" enter-from-class="scale-0 opacity-0">
                <span v-if="sepetAdetUrun(u.id)" class="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-gold-gradient text-white text-xs font-bold flex items-center justify-center shadow-gold-edge">
                  {{ sepetAdetUrun(u.id) }}
                </span>
              </Transition>
            </div>

            <!-- İçerik -->
            <div class="p-3 flex flex-col flex-1">
              <h3 class="font-semibold text-sm leading-tight text-pearl line-clamp-1">{{ u.ad }}</h3>
              <p v-if="u.aciklama" class="text-[11px] text-pearl-50 mt-0.5 line-clamp-2 leading-snug">{{ u.aciklama }}</p>
              <div class="mt-auto flex items-end justify-between pt-2.5">
                <span class="text-lg font-bold gold-text leading-none">{{ paraFormat(u.fiyat) }}</span>
                <button
                  @click="sepeteEkle(u)"
                  class="w-9 h-9 rounded-xl bg-gold-gradient text-white shadow-gold-edge hover:scale-110 active:scale-90 transition flex items-center justify-center"
                  aria-label="Sepete ekle"
                >
                  <i class="fas fa-plus text-sm" />
                </button>
              </div>
            </div>
          </article>
        </div>
        </template>
      </div>

      <!-- ═══════════════ HESAP / ÖDEME GÖRÜNÜMÜ ═══════════════ -->
      <div v-show="gorunum === 'hesap' && masaId" class="max-w-3xl mx-auto px-4 pt-5 space-y-4">
        <div v-if="hesapYukleniyor" class="surface-elevated p-12 text-center">
          <i class="fas fa-spinner fa-spin text-3xl text-gold-primary" />
        </div>

        <template v-else-if="hesap">
          <div v-if="hesap.bos" class="surface-elevated p-10 text-center text-pearl-50 shadow-glass">
            <div class="w-16 h-16 mx-auto rounded-2xl bg-gold-soft flex items-center justify-center text-3xl text-gold-primary/50 mb-4">
              <i class="fas fa-receipt" />
            </div>
            <p class="mb-1 text-pearl-70 font-medium">Bu masada henüz açık hesap yok.</p>
            <p class="text-sm">Menüden sipariş verdiğinizde hesabınız burada görünecek.</p>
          </div>

          <template v-else>
            <!-- Hesap dökümü -->
            <div class="surface-elevated overflow-hidden shadow-elevated">
              <div class="p-4 bg-gold-soft/60 border-b border-pearl-10 flex items-center justify-between">
                <div>
                  <div class="text-[10px] text-gold-dark/70 uppercase tracking-widest font-semibold">Hesap No</div>
                  <div class="font-bold gold-text">{{ hesap.numara }}</div>
                </div>
                <div class="text-right">
                  <div class="text-[10px] text-gold-dark/70 uppercase tracking-widest font-semibold">Masa</div>
                  <div class="font-bold text-pearl">{{ hesap.masa.ad }}</div>
                </div>
              </div>

              <div class="p-4 space-y-2.5">
                <div v-for="(k, i) in hesap.kalemler" :key="i" class="flex items-center gap-3 text-sm">
                  <span class="w-7 h-7 shrink-0 rounded-lg bg-gold-soft text-gold-dark text-xs font-bold flex items-center justify-center">{{ k.adet }}</span>
                  <span class="flex-1 min-w-0 truncate text-pearl">{{ k.ad }}</span>
                  <span class="text-pearl-50 text-xs">{{ paraFormat(k.birimFiyat) }}</span>
                  <span class="font-semibold w-20 text-right text-pearl">{{ paraFormat(k.toplam) }}</span>
                </div>
              </div>

              <div class="p-4 border-t border-pearl-10 space-y-1.5 text-sm bg-ink-100/50">
                <div class="flex justify-between text-pearl-60"><span>Ara Toplam</span><span>{{ paraFormat(hesap.araToplam) }}</span></div>
                <div class="flex justify-between text-pearl-60"><span>KDV</span><span>{{ paraFormat(hesap.kdvTutar) }}</span></div>
                <div class="flex justify-between font-bold text-base pt-1"><span class="text-pearl">Toplam</span><span class="gold-text">{{ paraFormat(hesap.toplamTutar) }}</span></div>
                <div v-if="(hesap.odenenTutar || 0) > 0" class="flex justify-between text-emerald-600 text-xs"><span>Ödenen</span><span>− {{ paraFormat(hesap.odenenTutar) }}</span></div>
                <div class="flex justify-between font-bold text-lg pt-2 border-t border-pearl-10 mt-1"><span class="text-pearl">Kalan</span><span class="gold-text">{{ paraFormat(hesap.kalanTutar) }}</span></div>
              </div>
            </div>

            <!-- Ödeme kutusu -->
            <div v-if="(hesap.kalanTutar || 0) > 0" class="surface-elevated p-4 space-y-3 shadow-glass">
              <div class="flex items-center gap-2 text-sm text-pearl-70">
                <i class="fas fa-shield-halved text-gold-primary" />
                <span>Güvenli online ödeme · <b class="text-pearl">PayTR Sanal POS</b></span>
              </div>
              <button v-if="!odemeAcik" @click="odemeAcik = true" class="btn-gold">
                <i class="fas fa-credit-card mr-2" />Kartla Öde · {{ paraFormat(hesap.kalanTutar) }}
              </button>

              <div v-if="odemeAcik" class="space-y-3">
                <input v-model="odemeAd" class="input-base" placeholder="Ad Soyad (fiş için, opsiyonel)" />
                <input v-model="odemeEposta" type="email" class="input-base" placeholder="E-posta (fiş için, opsiyonel)" />
                <button @click="odemeyiBaslat" :disabled="odemeBaslatiliyor" class="btn-gold">
                  <i v-if="odemeBaslatiliyor" class="fas fa-spinner fa-spin mr-2" />
                  <i v-else class="fas fa-lock mr-2" />
                  {{ odemeBaslatiliyor ? 'Yönlendiriliyor...' : `${paraFormat(hesap.kalanTutar)} Öde` }}
                </button>
                <p class="text-[11px] text-pearl-50 text-center">Ödeme güvenli sayfada tamamlanır. Kart bilgileriniz işletmeyle paylaşılmaz.</p>
              </div>
            </div>

            <div v-else class="surface-elevated p-6 text-center text-emerald-600 shadow-glass">
              <i class="fas fa-circle-check text-3xl mb-2 block" />
              <p class="font-semibold">Hesabınız tamamen ödendi. Teşekkürler!</p>
            </div>

            <button @click="hesapYukle" class="w-full text-sm text-pearl-60 hover:text-gold-primary py-2 font-medium">
              <i class="fas fa-rotate mr-1.5" />Hesabı Yenile
            </button>
          </template>
        </template>
      </div>

      <!-- ═══════ Alt Sepet Butonu (yüzen) ═══════ -->
      <Transition
        enter-active-class="transition duration-300" leave-active-class="transition duration-200"
        enter-from-class="translate-y-24 opacity-0" leave-to-class="translate-y-24 opacity-0"
      >
        <div v-if="sepet.length && gorunum === 'menu'" class="fixed bottom-0 left-0 right-0 p-4 z-30 pointer-events-none">
          <div class="max-w-3xl mx-auto pointer-events-auto">
            <button
              @click="sepetAcik = true"
              class="w-full bg-gold-gradient text-white py-4 px-5 rounded-2xl font-semibold shadow-gold-glow-strong hover:scale-[1.02] active:scale-[0.98] transition flex items-center justify-between"
            >
              <span class="flex items-center gap-3">
                <span class="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">{{ sepetAdet }}</span>
                <span class="text-left leading-tight">
                  <span class="block text-[11px] uppercase tracking-widest opacity-80">Sepeti Görüntüle</span>
                  <span class="block text-sm">{{ sepetAdet }} ürün</span>
                </span>
              </span>
              <span class="text-xl font-bold">{{ paraFormat(sepetToplam) }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </template>
  </div>
</template>
