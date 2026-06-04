<script setup lang="ts">
import { paraFormat, saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'], layout: 'default' });

interface Urun {
  id: string;
  ad: string;
  fiyat: string | number;
  kdvOrani: string | number;
  resimUrl?: string | null;
  kategoriId?: string | null;
  aktif: boolean;
  kategori?: { id: string; ad: string; renk?: string | null } | null;
}

interface Kategori {
  id: string;
  ad: string;
  renk?: string | null;
  ikon?: string | null;
}

interface SiparisKalem {
  id: string;
  urunId: string;
  adet: number;
  birimFiyat: string | number;
  toplam: string | number;
  not?: string | null;
  iptal: boolean;
  urun: { id: string; ad: string; kdvOrani: string | number };
}

interface Siparis {
  id: string;
  durum: string;
  kaynak: string;
  not?: string | null;
  olusturuldu: string;
  kalemler: SiparisKalem[];
}

interface Odeme {
  id: string;
  tip: string;
  tutar: string | number;
  bahsis: string | number;
  iptal: boolean;
  olusturuldu: string;
}

interface AdisyonDetay {
  id: string;
  subeId: string;
  numara: string;
  durum: 'ACIK' | 'ODEME_BEKLIYOR' | 'KAPALI' | 'IPTAL';
  araToplam: string | number;
  iskontoTutar: string | number;
  kdvTutar: string | number;
  toplamTutar: string | number;
  not?: string | null;
  acilis: string;
  kapanis?: string | null;
  masa?: { id: string; ad: string } | null;
  acanKullanici: { id: string; adSoyad: string };
  siparisler: Siparis[];
  odemeler: Odeme[];
}

const route = useRoute();
const adisyonId = route.params.id as string;

const adisyon = ref<AdisyonDetay | null>(null);
const urunler = ref<Urun[]>([]);
const kategoriler = ref<Kategori[]>([]);
const aktifKategori = ref<string>('');
const arama = ref('');
const yukleniyor = ref(false);
const hata = ref('');

// Sepet — bekleyen kalemler (henüz siparişe gitmedi)
const sepet = ref<Array<{ urun: Urun; adet: number; not: string }>>([]);

async function yukle() {
  yukleniyor.value = true;
  hata.value = '';
  try {
    const a = await apiFetch<AdisyonDetay>(`/adisyonlar/${adisyonId}`);
    adisyon.value = a;
    if (!urunler.value.length) {
      const [u, k] = await Promise.all([
        apiFetch<Urun[]>(`/urunler?subeId=${a.subeId}`),
        apiFetch<Kategori[]>(`/kategoriler?subeId=${a.subeId}`),
      ]);
      urunler.value = u.filter((x) => x.aktif);
      kategoriler.value = k;
    }
  } catch (e: any) {
    hata.value = e?.data?.message || 'Yüklenemedi';
  } finally {
    yukleniyor.value = false;
  }
}

const { on } = useSocket();
onMounted(() => {
  yukle();
  // NOT: Müşteri ekranı yayını burada DEĞİL — sadece ödeme modali açıldığında
  // başlar. Kasiyer adisyon detayda gezerken müşteri ekranı logo/hoş geldiniz
  // ekranında kalır. Yayın AppOdemeEkrani lifecycle'ı içinden yönetilir.

  const off1 = on('siparis:yeni', (v: any) => {
    if (v?.adisyonId === adisyonId) yukle();
  });
  const off2 = on('adisyon:guncel', (v: any) => {
    if (v?.adisyonId === adisyonId) yukle();
  });
  const off3 = on('odeme:yeni', (v: any) => {
    if (v?.adisyonId === adisyonId) yukle();
  });
  onUnmounted(() => {
    off1?.();
    off2?.();
    off3?.();
  });
});

const filtreli = computed(() => {
  let liste = urunler.value;
  if (aktifKategori.value) liste = liste.filter((u) => u.kategoriId === aktifKategori.value);
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    liste = liste.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q));
  }
  return liste;
});

// Sepet işlemleri
function sepeteEkle(u: Urun) {
  const v = sepet.value.find((s) => s.urun.id === u.id);
  if (v) v.adet++;
  else sepet.value.push({ urun: u, adet: 1, not: '' });
}

function sepetAzalt(idx: number) {
  if (sepet.value[idx].adet > 1) sepet.value[idx].adet--;
  else sepet.value.splice(idx, 1);
}

function sepetSil(idx: number) {
  sepet.value.splice(idx, 1);
}

const sepetToplam = computed(() =>
  sepet.value.reduce((acc, s) => acc + Number(s.urun.fiyat) * s.adet, 0),
);

const siparisGonderiliyor = ref(false);

async function siparisVer() {
  if (!sepet.value.length) return;
  siparisGonderiliyor.value = true;
  try {
    await apiFetch('/siparisler', {
      method: 'POST',
      body: {
        adisyonId,
        kaynak: 'PANEL',
        kalemler: sepet.value.map((s) => ({
          urunId: s.urun.id,
          adet: s.adet,
          not: s.not || undefined,
        })),
      },
    });
    sepet.value = [];
    await yukle();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Sipariş gönderilemedi');
  } finally {
    siparisGonderiliyor.value = false;
  }
}

const { onay } = useOnay();

async function kalemIptal(kalemId: string) {
  if (!(await onay({
    baslik: 'Kalemi iptal et',
    mesaj: 'Bu kalem iptal edilecek. Adisyon tutarı yeniden hesaplanır.',
    onayMetni: 'İptal et',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/siparisler/kalem/${kalemId}`, { method: 'DELETE' });
    await yukle();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'İptal edilemedi');
  }
}

async function adisyonIptal() {
  if (!adisyon.value) return;
  if (!(await onay({
    baslik: 'Adisyonu iptal et',
    mesaj: `Adisyon ${adisyon.value.numara} iptal edilecek. Yapılan ödemeler varsa önce onları iptal etmelisin.`,
    onayMetni: 'İptal et',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/adisyonlar/${adisyonId}/iptal`, { method: 'POST' });
    await navigateTo('/adisyonlar');
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'İptal edilemedi');
  }
}

// ─── Ödeme ekranı (tam ekran komponent) ───
const odemeAcik = ref(false);
function odemeModalAc() {
  odemeAcik.value = true;
}

/**
 * Kısmi ödeme alındı veya kullanıcı fişi onayladı → adisyon'u yenile,
 * AMA modal'ı kapatma. Modal kendi içinde state'ini sıfırlayıp bir sonraki
 * parça için hazır olacak.
 */
async function odemeYenile() {
  await yukle();
}

/**
 * Modal kapanıyor (kullanıcı X'e bastı, fiş'i onayladı, vs.).
 * Adisyon kapalıysa otomatik adisyonlar listesine dön.
 */
async function odemeKapandi() {
  odemeAcik.value = false;
  await yukle();
  if (adisyon.value?.durum === 'KAPALI') {
    setTimeout(() => navigateTo('/adisyonlar'), 1200);
  }
}

const odenmis = computed(() =>
  (adisyon.value?.odemeler || []).filter((o) => !o.iptal).reduce((acc, o) => acc + Number(o.tutar), 0),
);
const kalan = computed(() => Math.max(0, Number(adisyon.value?.toplamTutar || 0) - odenmis.value));

const iskontoModalAcik = ref(false);
const iskontoTutar = ref(0);

function iskontoModalAc() {
  iskontoTutar.value = Number(adisyon.value?.iskontoTutar || 0);
  iskontoModalAcik.value = true;
}

async function iskontoUygula() {
  try {
    await apiFetch(`/adisyonlar/${adisyonId}`, {
      method: 'PATCH',
      body: { iskontoTutar: Number(iskontoTutar.value) },
    });
    iskontoModalAcik.value = false;
    await yukle();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'İskonto uygulanamadı');
  }
}


// Düz kalem listesi (iptal edilmemiş)
const tumKalemler = computed(() => {
  if (!adisyon.value) return [];
  return adisyon.value.siparisler.flatMap((s) => s.kalemler.filter((k) => !k.iptal));
});

// ─── e-Belge (e-Arşiv / e-Fatura) düzenleme ───
const faturaModalAcik = ref(false);
const faturaYukleniyor = ref(false);
const faturaTip = ref<'E_ARSIV' | 'E_FATURA' | 'E_SMM'>('E_ARSIV');
const faturaAlici = reactive({
  ad: '',
  vergiNo: '',
  vergiDairesi: '',
  adres: '',
  eposta: '',
});
const faturaSonuc = ref<any>(null);

function faturaModalAc() {
  faturaSonuc.value = null;
  faturaTip.value = 'E_ARSIV';
  Object.assign(faturaAlici, {
    ad: adisyon.value?.musteri?.adSoyad || '',
    vergiNo: '',
    vergiDairesi: '',
    adres: '',
    eposta: '',
  });
  faturaModalAcik.value = true;
}

async function faturaDuzenle() {
  if (!faturaAlici.ad.trim()) {
    useToastStore().uyari('Alıcı adı zorunlu');
    return;
  }
  if (faturaTip.value === 'E_FATURA' && !faturaAlici.vergiNo.trim()) {
    useToastStore().uyari('e-Fatura için VKN zorunludur');
    return;
  }
  if (faturaAlici.vergiNo && !/^\d{10}$|^\d{11}$/.test(faturaAlici.vergiNo.trim())) {
    useToastStore().uyari('Vergi no 10 hane (VKN) veya 11 hane (TCKN) olmalı');
    return;
  }
  faturaYukleniyor.value = true;
  try {
    const sonuc = await apiFetch<any>(`/e-belge/fatura-duzenle/${adisyonId}`, {
      method: 'POST',
      body: {
        tip: faturaTip.value,
        alici: {
          ad: faturaAlici.ad.trim(),
          vergiNo: faturaAlici.vergiNo.trim() || undefined,
          vergiDairesi: faturaAlici.vergiDairesi.trim() || undefined,
          adres: faturaAlici.adres.trim() || undefined,
          eposta: faturaAlici.eposta.trim() || undefined,
        },
      },
    });
    faturaSonuc.value = sonuc;
    useToastStore().basari(`${sonuc.belgeNo} düzenlendi`);
    await yukle();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'e-Belge düzenlenemedi');
  } finally {
    faturaYukleniyor.value = false;
  }
}
</script>

<template>
  <div v-if="yukleniyor && !adisyon" class="text-center py-12 text-pearl-50">
    <i class="fas fa-spinner fa-spin text-2xl" />
  </div>

  <div v-else-if="hata" class="glass-card p-6 border-red-500/30 text-red-300">
    <i class="fas fa-exclamation-triangle mr-2" />{{ hata }}
  </div>

  <template v-else-if="adisyon">
    <!-- Tam genişlik 3-panel POS layout -->
    <div class="-mx-4 sm:-mx-5 lg:-mx-6 -my-4 sm:-my-5 lg:-my-6 flex min-h-[calc(100vh-65px)] flex-col md:flex-row">
      <!-- SOL: Hızlı aksiyon paneli -->
      <AppActionBar
        :ogeler="[
          { ad: 'Geri', ikon: 'fa-arrow-left', onClick: () => navigateTo('/masalar') },
          { ad: 'İskonto', ikon: 'fa-percent', onClick: iskontoModalAc, disabled: adisyon.durum === 'KAPALI' || adisyon.durum === 'IPTAL' },
          { ad: 'e-Fatura', ikon: 'fa-file-invoice', vurgu: true, onClick: faturaModalAc, disabled: adisyon.durum === 'IPTAL' },
          { ad: 'Yazdır', ikon: 'fa-print' },
          { ad: 'İptal', ikon: 'fa-ban', tehlike: true, onClick: adisyonIptal, disabled: adisyon.durum === 'KAPALI' || adisyon.durum === 'IPTAL' },
        ]"
      />

      <!-- SOL ORTA: Adisyon listesi + ÖDEME AL -->
      <section class="w-full md:w-80 lg:w-96 shrink-0 bg-white border-b md:border-b-0 md:border-r border-pearl-10 flex flex-col">
        <!-- Başlık -->
        <div class="p-5 border-b border-pearl-10">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span
                :class="[
                  'badge !text-[9px]',
                  adisyon.durum === 'ACIK' && 'badge-success',
                  adisyon.durum === 'ODEME_BEKLIYOR' && 'badge-info',
                  adisyon.durum === 'KAPALI' && 'badge bg-pearl-10 text-pearl-50',
                  adisyon.durum === 'IPTAL' && 'badge-danger',
                ]"
              >
                {{ adisyon.durum === 'ACIK' ? 'Açık' : adisyon.durum === 'ODEME_BEKLIYOR' ? 'Ödeme Bekliyor' : adisyon.durum === 'KAPALI' ? 'Kapalı' : 'İptal' }}
              </span>
              <span class="text-[10px] text-pearl-50 tabular">{{ saatFormat(adisyon.acilis) }}</span>
            </div>
          </div>
          <h1 class="text-2xl font-light text-pearl tracking-tight flex items-center gap-2">
            <i class="fas fa-table text-gold-primary/60 text-base" v-if="adisyon.masa" />
            {{ adisyon.masa?.ad || 'Masasız' }}
          </h1>
          <div class="text-[10px] text-pearl-40 mt-0.5 tabular">{{ adisyon.numara }}</div>
        </div>

        <!-- Sipariş kalemleri -->
        <div class="flex-1 overflow-y-auto p-3 space-y-1">
          <div v-if="!tumKalemler.length && !sepet.length" class="text-center py-12 text-pearl-50 text-sm">
            <i class="fas fa-receipt text-3xl text-pearl-30 mb-3 block" />
            Sağdan ürün seçerek ekle
          </div>

          <!-- Mevcut kalemler -->
          <div
            v-for="k in tumKalemler"
            :key="k.id"
            class="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-pearl-5 transition"
          >
            <span class="w-9 h-9 rounded-lg bg-gold-soft border border-gold-primary/20 text-gold-primary text-sm font-bold flex items-center justify-center shrink-0 tabular">
              {{ k.adet }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium text-pearl leading-tight">{{ k.urun.ad }}</div>
              <div v-if="k.not" class="text-[10px] text-gold-primary/70 mt-0.5">
                <i class="fas fa-note-sticky" /> {{ k.not }}
              </div>
            </div>
            <div class="text-sm font-medium tabular text-pearl shrink-0">{{ paraFormat(k.toplam) }}</div>
            <button
              v-if="adisyon.durum !== 'KAPALI' && adisyon.durum !== 'IPTAL'"
              @click="kalemIptal(k.id)"
              class="opacity-0 group-hover:opacity-100 transition text-pearl-50 hover:text-red-300 p-1"
            >
              <i class="fas fa-times text-xs" />
            </button>
          </div>

          <!-- Bekleyen sepet (henüz gönderilmedi) -->
          <div v-if="sepet.length" class="border-t border-dashed border-gold-primary/30 mt-3 pt-3">
            <div class="flex items-center justify-between px-3 pb-2">
              <span class="text-[10px] uppercase tracking-extra-wide text-gold-primary font-semibold">Eklenecek</span>
              <button @click="sepet = []" class="text-[10px] text-pearl-50 hover:text-red-300">Temizle</button>
            </div>
            <div
              v-for="(s, i) in sepet"
              :key="i"
              class="flex items-center gap-2 px-3 py-2"
            >
              <div class="flex items-center bg-ink-300 rounded-lg overflow-hidden">
                <button @click="sepetAzalt(i)" class="w-7 h-7 hover:bg-pearl-10 text-gold-primary text-sm">−</button>
                <span class="w-7 text-center text-sm font-bold tabular">{{ s.adet }}</span>
                <button @click="s.adet++" class="w-7 h-7 hover:bg-pearl-10 text-gold-primary text-sm">+</button>
              </div>
              <div class="flex-1 text-sm truncate text-pearl-80">{{ s.urun.ad }}</div>
              <div class="text-sm font-medium tabular">{{ paraFormat(Number(s.urun.fiyat) * s.adet) }}</div>
              <button @click="sepetSil(i)" class="text-pearl-50 hover:text-red-300 p-1 text-xs">
                <i class="fas fa-times" />
              </button>
            </div>

            <button
              @click="siparisVer"
              :disabled="siparisGonderiliyor"
              class="mt-3 mx-3 mb-1 w-[calc(100%-1.5rem)] btn-ghost !py-2.5"
            >
              <i v-if="siparisGonderiliyor" class="fas fa-spinner fa-spin mr-2" />
              <i v-else class="fas fa-paper-plane mr-2 text-gold-primary" />
              <span class="text-pearl">{{ siparisGonderiliyor ? 'Gönderiliyor...' : 'Siparişi Gönder' }}</span>
              <span class="text-gold-primary ml-2 tabular">{{ paraFormat(sepetToplam) }}</span>
            </button>
          </div>
        </div>

        <!-- Alt: Toplamlar + Öde -->
        <div class="border-t border-pearl-10 bg-ink-200 p-4">
          <div class="space-y-1.5 text-sm mb-4">
            <div class="flex justify-between text-pearl-60">
              <span>Ara Toplam</span>
              <span class="tabular">{{ paraFormat(adisyon.araToplam) }}</span>
            </div>
            <div v-if="Number(adisyon.iskontoTutar) > 0" class="flex justify-between text-amber-300">
              <span>İskonto</span>
              <span class="tabular">− {{ paraFormat(adisyon.iskontoTutar) }}</span>
            </div>
            <div v-if="odenmis > 0" class="flex justify-between text-emerald-300">
              <span>Ödenen</span>
              <span class="tabular">− {{ paraFormat(odenmis) }}</span>
            </div>
          </div>

          <div class="flex items-end justify-between mb-3">
            <div>
              <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">
                {{ odenmis > 0 ? 'Kalan' : 'Toplam' }}
              </div>
              <div class="text-3xl font-light gold-text tabular leading-none">
                {{ paraFormat(odenmis > 0 ? kalan : adisyon.toplamTutar) }}
              </div>
            </div>
          </div>

          <button
            v-if="adisyon.durum !== 'KAPALI' && adisyon.durum !== 'IPTAL'"
            @click="odemeModalAc"
            :disabled="Number(adisyon.toplamTutar) <= 0 || kalan <= 0"
            class="btn-gold !py-4 !text-base"
          >
            <i class="fas fa-credit-card mr-2" />
            ÖDEME AL
          </button>
        </div>
      </section>

      <!-- ORTA: Ürün Grid -->
      <main class="flex-1 overflow-y-auto bg-ink-50 p-4 sm:p-5 min-w-0">
        <!-- Üst arama + breadcrumb -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-5">
          <div class="text-sm text-pearl-60 truncate">
            <span class="text-pearl-50">Menü</span>
            <i class="fas fa-chevron-right mx-2 text-[10px] text-pearl-40" />
            <span class="text-pearl font-medium">
              {{ aktifKategori ? kategoriler.find(k => k.id === aktifKategori)?.ad || 'Tümü' : 'Tümü' }}
            </span>
          </div>
          <div class="relative w-full sm:w-72">
            <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50 text-xs" />
            <input
              v-model="arama"
              class="input-base !py-2.5 pl-10 !text-sm"
              placeholder="Ürün ara..."
            />
          </div>
        </div>

        <!-- Mobil/tablet kategori filtre (yatay scroll) -->
        <div class="md:hidden mb-4 -mx-4 px-4 overflow-x-auto flex gap-2 pb-1">
          <button
            @click="aktifKategori = ''"
            :class="[
              'shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium border transition whitespace-nowrap',
              aktifKategori === ''
                ? 'bg-gold-soft border-gold-primary/40 text-gold-primary'
                : 'border-pearl-10 text-pearl-60'
            ]"
          >
            Tümü <span class="tabular text-pearl-40 ml-1">{{ urunler.length }}</span>
          </button>
          <button
            v-for="k in kategoriler"
            :key="k.id"
            @click="aktifKategori = k.id"
            :class="[
              'shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium border transition whitespace-nowrap flex items-center gap-1.5',
              aktifKategori === k.id
                ? 'bg-gold-soft border-gold-primary/40 text-gold-primary'
                : 'border-pearl-10 text-pearl-60'
            ]"
          >
            <span v-if="k.renk" class="w-1.5 h-1.5 rounded-full" :style="{ background: k.renk }" />
            {{ k.ad }}
          </button>
        </div>

        <!-- Ürün grid (fotoğraflı kart) -->
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
          <button
            v-for="u in filtreli"
            :key="u.id"
            @click="sepeteEkle(u)"
            :disabled="adisyon.durum === 'KAPALI' || adisyon.durum === 'IPTAL'"
            class="group bg-ink-200 border border-pearl-10 rounded-2xl overflow-hidden text-left hover:border-gold-primary/40 hover:bg-ink-300 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <!-- Resim alanı -->
            <div
              v-if="u.resimUrl"
              class="aspect-square bg-ink-100 bg-cover bg-center"
              :style="{ backgroundImage: `url('${u.resimUrl}')` }"
            />
            <div
              v-else
              class="aspect-square bg-gradient-to-br from-ink-300 to-ink-100 flex items-center justify-center text-4xl text-gold-primary/30 group-hover:text-gold-primary/50 transition"
            >
              <i class="fas fa-utensils" />
            </div>

            <!-- Bilgi -->
            <div class="p-3">
              <div class="font-medium text-pearl leading-snug line-clamp-2 min-h-[2.5rem] text-sm">
                {{ u.ad }}
              </div>
              <div class="text-base font-medium gold-text tabular mt-2">
                {{ paraFormat(u.fiyat) }}
              </div>
            </div>
          </button>
        </div>

        <div v-if="!filtreli.length" class="text-center py-16 text-pearl-50">
          <i class="fas fa-utensils text-4xl text-pearl-30 mb-3 block" />
          <p>Ürün bulunamadı</p>
        </div>
      </main>

      <!-- SAĞ: Kategori Tab'ları -->
      <nav class="hidden md:flex flex-col w-44 bg-ink-200 border-l border-pearl-10 py-4 overflow-y-auto">
        <div class="px-4 mb-3">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-40 font-semibold">Menü</div>
        </div>
        <button
          @click="aktifKategori = ''"
          :class="[
            'w-full text-left px-5 py-3.5 transition flex items-center justify-between text-sm font-medium',
            aktifKategori === ''
              ? 'bg-white text-gold-primary border-l-2 border-gold-primary'
              : 'text-pearl-60 hover:text-pearl hover:bg-pearl-5',
          ]"
        >
          <span>Tümü</span>
          <span class="text-[10px] tabular text-pearl-40">{{ urunler.length }}</span>
        </button>
        <button
          v-for="k in kategoriler"
          :key="k.id"
          @click="aktifKategori = k.id"
          :class="[
            'w-full text-left px-5 py-3.5 transition flex items-center justify-between text-sm font-medium',
            aktifKategori === k.id
              ? 'bg-white text-gold-primary border-l-2 border-gold-primary'
              : 'text-pearl-60 hover:text-pearl hover:bg-pearl-5',
          ]"
        >
          <span class="flex items-center gap-2 truncate">
            <span v-if="k.renk" class="w-1.5 h-1.5 rounded-full shrink-0" :style="{ background: k.renk }" />
            <span class="truncate">{{ k.ad }}</span>
          </span>
          <span class="text-[10px] tabular text-pearl-40 ml-2">{{ urunler.filter(u => u.kategoriId === k.id).length }}</span>
        </button>
      </nav>
    </div>

    <AppOdemeEkrani
      :acik="odemeAcik"
      :adisyon="adisyon"
      @kapat="odemeKapandi"
      @yenile="odemeYenile"
      @tamamlandi="odemeKapandi"
    />

    <!-- İskonto Modal -->
    <AppModal
      :acik="iskontoModalAcik"
      baslik="İskonto Uygula"
      genislik="max-w-md"
      @kapat="iskontoModalAcik = false"
    >
      <div class="space-y-5">
        <div class="text-center pb-4 border-b border-glass-border">
          <div class="text-xs text-pearl-50 uppercase tracking-wider">Ara Toplam</div>
          <div class="text-2xl font-bold gold-text mt-1">{{ paraFormat(adisyon.araToplam) }}</div>
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">İskonto Tutarı (₺)</label>
          <input v-model.number="iskontoTutar" type="number" min="0" step="0.01" class="input-base text-lg font-semibold" />
        </div>
        <div class="grid grid-cols-4 gap-2">
          <button @click="iskontoTutar = Number(adisyon.araToplam) * 0.05" class="glass-card py-2 text-xs hover:bg-glass-hover transition">%5</button>
          <button @click="iskontoTutar = Number(adisyon.araToplam) * 0.10" class="glass-card py-2 text-xs hover:bg-glass-hover transition">%10</button>
          <button @click="iskontoTutar = Number(adisyon.araToplam) * 0.15" class="glass-card py-2 text-xs hover:bg-glass-hover transition">%15</button>
          <button @click="iskontoTutar = 0" class="glass-card py-2 text-xs hover:bg-glass-hover transition">Sıfırla</button>
        </div>
        <div class="flex gap-3 pt-2">
          <button type="button" @click="iskontoModalAcik = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">
            İptal
          </button>
          <button @click="iskontoUygula" class="btn-gold flex-1">
            <i class="fas fa-check mr-2" />Uygula
          </button>
        </div>
      </div>
    </AppModal>

    <!-- e-Fatura / e-Arşiv Modal -->
    <AppModal
      :acik="faturaModalAcik"
      baslik="e-Belge Düzenle"
      genislik="max-w-lg"
      @kapat="faturaModalAcik = false; faturaSonuc = null"
    >
      <!-- Başarılı sonuç ekranı -->
      <div v-if="faturaSonuc" class="space-y-4 text-center">
        <div class="w-16 h-16 rounded-full bg-emerald-500/15 border-2 border-emerald-500 flex items-center justify-center mx-auto">
          <i class="fas fa-check text-2xl text-emerald-600" />
        </div>
        <h3 class="text-lg font-semibold text-pearl">{{ faturaSonuc.tip === 'E_ARSIV' ? 'e-Arşiv Fatura' : 'e-Fatura' }} düzenlendi</h3>
        <div class="surface-elevated p-4 text-left space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-pearl-50">Belge No</span>
            <span class="font-mono text-gold-dark tabular">{{ faturaSonuc.belgeNo }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-pearl-50">ETTN</span>
            <span class="font-mono text-pearl-70 text-xs tabular">{{ faturaSonuc.ettn }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-pearl-50">Alıcı</span>
            <span class="text-pearl">{{ faturaSonuc.aliciAd }}</span>
          </div>
          <div v-if="faturaSonuc.aliciVergiNo" class="flex justify-between">
            <span class="text-pearl-50">{{ faturaSonuc.aliciVergiNo.length === 10 ? 'VKN' : 'TCKN' }}</span>
            <span class="font-mono tabular text-pearl">{{ faturaSonuc.aliciVergiNo }}</span>
          </div>
          <div class="flex justify-between pt-2 border-t border-pearl-10">
            <span class="text-pearl-70 font-medium">Toplam</span>
            <span class="font-bold gold-text tabular">{{ paraFormat(faturaSonuc.toplamTutar) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-pearl-50">Durum</span>
            <span class="badge-success !text-[10px]">{{ faturaSonuc.durum }}</span>
          </div>
        </div>
        <p class="text-xs text-pearl-50">
          Belge GİB sistemine gönderildi · {{ faturaSonuc.marka }} entegratör
        </p>
        <button @click="faturaModalAcik = false; faturaSonuc = null" class="btn-gold">
          <i class="fas fa-check mr-2" />Tamam
        </button>
      </div>

      <!-- Form -->
      <form v-else @submit.prevent="faturaDuzenle" class="space-y-4">
        <!-- Belge tipi -->
        <div>
          <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-50 mb-2 font-semibold">Belge Tipi</label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="t in [
                { kod: 'E_ARSIV', ad: 'e-Arşiv', alt: 'B2C' },
                { kod: 'E_FATURA', ad: 'e-Fatura', alt: 'B2B · VKN şart' },
                { kod: 'E_SMM', ad: 'e-SMM', alt: 'Serbest Meslek' },
              ]"
              :key="t.kod"
              type="button"
              @click="faturaTip = t.kod as any"
              :class="[
                'p-3 rounded-xl border-2 transition text-center',
                faturaTip === t.kod ? 'bg-gold-soft border-gold-primary/50 text-gold-dark' : 'border-pearl-10 text-pearl-60 hover:border-pearl-30',
              ]"
            >
              <div class="text-sm font-semibold">{{ t.ad }}</div>
              <div class="text-[10px] text-pearl-50 mt-0.5">{{ t.alt }}</div>
            </button>
          </div>
        </div>

        <!-- Alıcı bilgileri -->
        <div>
          <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">Alıcı Adı / Ünvan *</label>
          <input v-model="faturaAlici.ad" class="input-base" placeholder="Ad Soyad veya Firma Ünvanı" required />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div class="col-span-2">
            <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">
              Vergi No / TCKN <span v-if="faturaTip === 'E_FATURA'" class="text-red-700">*</span>
            </label>
            <input
              v-model="faturaAlici.vergiNo"
              class="input-base font-mono tabular"
              placeholder="10 hane VKN veya 11 hane TCKN"
              maxlength="11"
              inputmode="numeric"
              :required="faturaTip === 'E_FATURA'"
            />
          </div>
          <div>
            <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">Vergi Dairesi</label>
            <input v-model="faturaAlici.vergiDairesi" class="input-base" placeholder="—" />
          </div>
        </div>

        <div>
          <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">Adres</label>
          <textarea v-model="faturaAlici.adres" class="input-base" rows="2" placeholder="Açık adres" />
        </div>

        <div>
          <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-50 mb-1.5 font-semibold">E-posta (PDF gönderimi)</label>
          <input v-model="faturaAlici.eposta" type="email" class="input-base" placeholder="ornek@firma.com" />
        </div>

        <!-- Tutar özeti -->
        <div class="bg-pearl-5 rounded-xl p-3 text-sm space-y-1">
          <div class="flex justify-between text-pearl-60">
            <span>Ara Toplam</span>
            <span class="tabular">{{ paraFormat(adisyon.araToplam) }}</span>
          </div>
          <div v-if="Number(adisyon.iskontoTutar) > 0" class="flex justify-between text-amber-700">
            <span>İskonto</span>
            <span class="tabular">− {{ paraFormat(adisyon.iskontoTutar) }}</span>
          </div>
          <div class="flex justify-between pt-1 border-t border-pearl-10 font-semibold">
            <span class="text-pearl">Belge Toplamı</span>
            <span class="gold-text tabular text-lg">{{ paraFormat(adisyon.toplamTutar) }}</span>
          </div>
        </div>

        <!-- Bilgi notu -->
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-800 leading-relaxed">
          <i class="fas fa-circle-info mr-1.5" />
          <b>593 No.lu VUK Tebliği:</b> e-Belge düzenlendiğinde mali değer faturada olur, ÖKC sadece "BİLGİ FİŞİ" basar. Aynı adisyona hem fatura hem ÖKC fişi kesilemez.
        </div>

        <div class="flex gap-3 pt-2">
          <button type="button" @click="faturaModalAcik = false" class="btn-ghost flex-1">İptal</button>
          <button type="submit" :disabled="faturaYukleniyor" class="btn-gold flex-1">
            <i v-if="faturaYukleniyor" class="fas fa-spinner fa-spin mr-2" />
            <i v-else class="fas fa-file-invoice mr-2" />
            {{ faturaYukleniyor ? 'GİB\'e gönderiliyor…' : 'Düzenle ve Gönder' }}
          </button>
        </div>
      </form>
    </AppModal>
  </template>
</template>
