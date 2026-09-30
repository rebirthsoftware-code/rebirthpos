<script setup lang="ts">
import { paraFormat, saatFormat } from '~/utils/format';
import { carpanliKod, okutulanUrunuBul } from '~/utils/barkod';

definePageMeta({ middleware: ['auth'] });

interface UrunStok {
  id: string;
  ad: string;
  stok: string | number;
  stokBirim: string;
  stokUyariEsigi: string | number;
  barkod?: string | null;
  fiyat?: string | number;
  stokTakibi?: boolean;
  kategori?: { id: string; ad: string } | null;
}

interface Hareket {
  id: string;
  tip: string;
  miktar: string | number;
  oncesi: string | number;
  sonrasi: string | number;
  aciklama?: string | null;
  olusturuldu: string;
  urun: { id: string; ad: string; stokBirim: string };
  kullanici?: { adSoyad: string } | null;
}

const sube = useSubeStore();
const urunler = ref<UrunStok[]>([]);
const hareketler = ref<Hareket[]>([]);
const yukleniyor = ref(false);
const arama = ref('');
const sekme = ref<'durum' | 'barkod' | 'hareket'>('durum');

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    if (sekme.value === 'durum') {
      urunler.value = await apiFetch<UrunStok[]>(`/stok/durum?subeId=${sube.aktifSubeId}`);
    } else if (sekme.value === 'barkod') {
      tumUrunler.value = await apiFetch<UrunStok[]>(`/urunler?subeId=${sube.aktifSubeId}`);
      nextTick(() => okutInput.value?.focus());
    } else {
      hareketler.value = await apiFetch<Hareket[]>(`/stok/hareketler?subeId=${sube.aktifSubeId}`);
    }
  } finally {
    yukleniyor.value = false;
  }
}

watch([() => sube.aktifSubeId, sekme], () => listele(), { immediate: true });

const filtreliUrun = computed(() => {
  if (!arama.value.trim()) return urunler.value;
  const q = arama.value.toLocaleLowerCase('tr');
  return urunler.value.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q));
});

const uyariSayisi = computed(() =>
  urunler.value.filter((u) => Number(u.stok) <= Number(u.stokUyariEsigi)).length,
);

// Hareket modal
const modalAcik = ref(false);
const secilenUrun = ref<UrunStok | null>(null);
const form = reactive({ tip: 'GIRIS', miktar: 0, aciklama: '' });

function hareketAc(u: UrunStok) {
  secilenUrun.value = u;
  Object.assign(form, { tip: 'GIRIS', miktar: 0, aciklama: '' });
  modalAcik.value = true;
}

const kaydediliyor = ref(false);

async function hareketKaydet() {
  if (!secilenUrun.value || form.miktar <= 0) return;
  kaydediliyor.value = true;
  try {
    await apiFetch('/stok/hareket', {
      method: 'POST',
      body: {
        urunId: secilenUrun.value.id,
        tip: form.tip,
        miktar: Number(form.miktar),
        aciklama: form.aciklama.trim() || undefined,
      },
    });
    modalAcik.value = false;
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  } finally {
    kaydediliyor.value = false;
  }
}

// ─── Barkodla toplu işlem (mal kabul / çıkış / fire / sayım) ───
const etiket = useEtiket();
const tumUrunler = ref<UrunStok[]>([]);
const okut = ref('');
const okutInput = ref<HTMLInputElement | null>(null);
const okutMiktar = ref(1);
const topluTip = ref<'GIRIS' | 'CIKIS' | 'FIRE' | 'DUZELTME'>('GIRIS');
const topluListe = ref<Array<{ urun: UrunStok; miktar: number }>>([]);
const topluAciklama = ref('');
const sonraEtiket = ref(false);
const topluKaydediliyor = ref(false);

const TOPLU_TIPLER = [
  { kod: 'GIRIS', ad: 'Mal Kabul (Giriş)', ikon: 'fa-arrow-down' },
  { kod: 'CIKIS', ad: 'Çıkış', ikon: 'fa-arrow-up' },
  { kod: 'FIRE', ad: 'Fire', ikon: 'fa-trash' },
  { kod: 'DUZELTME', ad: 'Sayım', ikon: 'fa-clipboard-check' },
] as const;

function etiketeEkle(u: UrunStok) {
  if (etiket.ekle({ ...u, fiyat: u.fiyat ?? 0, stokTakibi: true })) useToastStore().basari(`${u.ad} etiket kuyruğuna eklendi`);
}

function topluEkle(u: UrunStok, miktar: number | null) {
  const m = miktar ?? (Number(okutMiktar.value) || 1);
  const var_ = topluListe.value.find((x) => x.urun.id === u.id);
  if (var_) var_.miktar = Number((var_.miktar + m).toFixed(3));
  else topluListe.value.unshift({ urun: u, miktar: m });
  okut.value = '';
}

const okutOneriler = computed(() => {
  const { kod } = carpanliKod(okut.value);
  if (kod.length < 2 || /^\d{6,}$/.test(kod)) return [];
  const q = kod.toLocaleLowerCase('tr');
  return tumUrunler.value.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q)).slice(0, 8);
});

function okutEnter() {
  const { miktar, kod } = carpanliKod(okut.value);
  if (!kod) return;
  const u = okutulanUrunuBul(tumUrunler.value, kod);
  if (u) return topluEkle(u, miktar);
  if (topluTip.value === 'GIRIS' && /^[\x20-\x7e]{3,}$/.test(kod) && !/\s/.test(kod)) {
    // Tanımsız barkod → hızlı ürün tanımla
    Object.assign(yeniUrun, { barkod: kod, ad: '', fiyat: 0, stokBirim: 'adet', miktar: miktar ?? (Number(okutMiktar.value) || 1) });
    yeniUrunModal.value = true;
  } else {
    useToastStore().hata(`"${kod}" bulunamadı`);
  }
  okut.value = '';
}

const yeniUrunModal = ref(false);
const yeniUrun = reactive({ barkod: '', ad: '', fiyat: 0, stokBirim: 'adet', miktar: 1 });
async function yeniUrunKaydet() {
  try {
    const u = await apiFetch<UrunStok>('/urunler', {
      method: 'POST',
      body: {
        subeId: sube.aktifSubeId,
        barkod: yeniUrun.barkod,
        ad: yeniUrun.ad.trim(),
        fiyat: Number(yeniUrun.fiyat),
        stokTakibi: true,
        stokBirim: yeniUrun.stokBirim,
        qrMenudeGoster: false,
      },
    });
    tumUrunler.value.push(u);
    topluEkle(u, yeniUrun.miktar);
    yeniUrunModal.value = false;
    useToastStore().basari(`${u.ad} tanımlandı`);
    nextTick(() => okutInput.value?.focus());
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Ürün kaydedilemedi');
  }
}

function yeniStok(s: { urun: UrunStok; miktar: number }) {
  const mevcut = Number(s.urun.stok);
  if (topluTip.value === 'DUZELTME') return s.miktar;
  if (topluTip.value === 'GIRIS') return mevcut + s.miktar;
  return Math.max(0, mevcut - s.miktar);
}

async function topluKaydet() {
  if (!topluListe.value.length || !sube.aktifSubeId) return;
  topluKaydediliyor.value = true;
  try {
    await apiFetch('/stok/toplu-hareket', {
      method: 'POST',
      body: {
        subeId: sube.aktifSubeId,
        tip: topluTip.value,
        aciklama: topluAciklama.value.trim() || undefined,
        kalemler: topluListe.value.map((s) => ({ urunId: s.urun.id, miktar: Number(s.miktar) })),
      },
    });
    useToastStore().basari(`${topluListe.value.length} kalem stoğa işlendi`);
    const islenen = topluListe.value;
    topluListe.value = [];
    topluAciklama.value = '';
    if (sonraEtiket.value && topluTip.value === 'GIRIS') {
      for (const s of islenen) etiket.ekle({ ...s.urun, fiyat: s.urun.fiyat ?? 0 }, Math.max(1, Math.ceil(s.miktar)));
      await navigateTo('/etiket');
      return;
    }
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'İşlenemedi');
  } finally {
    topluKaydediliyor.value = false;
  }
}

const tipStil: Record<string, { renk: string; ad: string; ikon: string }> = {
  GIRIS: { renk: 'emerald', ad: 'Giriş', ikon: 'fa-arrow-down' },
  CIKIS: { renk: 'red', ad: 'Çıkış', ikon: 'fa-arrow-up' },
  SATIS: { renk: 'blue', ad: 'Satış', ikon: 'fa-cart-shopping' },
  IADE: { renk: 'cyan', ad: 'İade', ikon: 'fa-rotate-left' },
  DUZELTME: { renk: 'amber', ad: 'Düzeltme', ikon: 'fa-pen' },
  FIRE: { renk: 'gray', ad: 'Fire', ikon: 'fa-trash' },
};
</script>

<template>
  <PageHeader baslik="Stok Yönetimi" aciklama="Stok takipli ürünler ve hareket geçmişi" ikon="fa-boxes-stacked">
    <template #actions>
      <span v-if="uyariSayisi > 0" class="text-xs bg-red-500/15 text-red-300 px-3 py-1.5 rounded-full">
        <i class="fas fa-triangle-exclamation mr-1.5" />{{ uyariSayisi }} ürün uyarı seviyesinde
      </span>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">Önce bir şube seç</div>

  <template v-else>
    <div class="flex gap-2 mb-6">
      <button
        @click="sekme = 'durum'"
        :class="['px-4 py-2 rounded-xl text-sm transition border', sekme === 'durum' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
      >
        <i class="fas fa-warehouse mr-1.5" /> Stok Durumu
      </button>
      <button
        @click="sekme = 'barkod'"
        :class="['px-4 py-2 rounded-xl text-sm transition border', sekme === 'barkod' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
      >
        <i class="fas fa-barcode mr-1.5" /> Barkodla İşlem
      </button>
      <button
        @click="sekme = 'hareket'"
        :class="['px-4 py-2 rounded-xl text-sm transition border', sekme === 'hareket' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
      >
        <i class="fas fa-list mr-1.5" /> Hareket Geçmişi
      </button>
    </div>

    <!-- Stok Durumu -->
    <template v-if="sekme === 'durum'">
      <div class="relative mb-4">
        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
        <input v-model="arama" class="input-base pl-11" placeholder="Ürün ara..." />
      </div>

      <div v-if="yukleniyor" class="text-center py-12"><i class="fas fa-spinner fa-spin text-2xl text-pearl-60" /></div>

      <EmptyState
        v-else-if="!urunler.length"
        ikon="fa-boxes-stacked"
        baslik="Stok takipli ürün yok"
        aciklama="Ürün yönetiminden bir ürünü açıp 'Stok Takibi' seçeneğini aç"
      />

      <div v-else class="space-y-2">
        <div
          v-for="u in filtreliUrun"
          :key="u.id"
          class="glass-card p-4 flex items-center gap-4 hover:bg-glass-hover transition"
        >
          <div class="flex-1 min-w-0">
            <div class="font-semibold">{{ u.ad }}</div>
            <div class="text-xs text-pearl-50">
              <span v-if="u.kategori">{{ u.kategori.ad }}</span>
              <span v-if="u.barkod" class="font-mono ml-1.5">{{ u.barkod }}</span>
            </div>
          </div>
          <div v-if="u.fiyat !== undefined" class="text-right shrink-0 hidden sm:block">
            <div class="text-[10px] text-pearl-50 uppercase">Fiyat</div>
            <div class="font-semibold tabular">{{ paraFormat(u.fiyat) }}</div>
          </div>
          <div class="text-right shrink-0">
            <div
              :class="[
                'text-xl font-bold',
                Number(u.stok) <= Number(u.stokUyariEsigi) ? 'text-red-300' : 'gold-text',
              ]"
            >
              {{ Number(u.stok).toLocaleString('tr-TR') }} {{ u.stokBirim }}
            </div>
            <div v-if="Number(u.stok) <= Number(u.stokUyariEsigi)" class="text-[10px] text-red-400 uppercase">
              <i class="fas fa-triangle-exclamation" /> Uyarı altı
            </div>
            <div v-else class="text-[10px] text-pearl-50">Uyarı eşik: {{ u.stokUyariEsigi }}</div>
          </div>
          <button
            v-if="u.barkod"
            @click="etiketeEkle(u)"
            class="glass-card py-2 px-3 text-xs hover:bg-glass-hover transition shrink-0"
            title="Etiket kuyruğuna ekle"
          >
            <i class="fas fa-barcode" />
          </button>
          <button
            @click="hareketAc(u)"
            class="glass-card py-2 px-3 text-xs hover:bg-glass-hover transition shrink-0"
          >
            <i class="fas fa-plus-minus mr-1" /> Hareket
          </button>
        </div>
      </div>
    </template>

    <!-- Barkodla toplu işlem -->
    <template v-else-if="sekme === 'barkod'">
      <div class="flex flex-wrap gap-2 mb-4">
        <button
          v-for="t in TOPLU_TIPLER"
          :key="t.kod"
          @click="topluTip = t.kod"
          :class="['px-3 py-2 rounded-xl text-sm border transition', topluTip === t.kod ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
        >
          <i :class="['fas', t.ikon, 'mr-1.5']" />{{ t.ad }}
        </button>
      </div>
      <p class="text-xs text-pearl-50 mb-3">
        <template v-if="topluTip === 'GIRIS'">Gelen malı okutun; miktarlar stoğa eklenir. Tanımsız barkod okutulursa ürün hemen tanımlanır.</template>
        <template v-else-if="topluTip === 'DUZELTME'">Saydığınız gerçek miktarı girin; stok bu değere eşitlenir.</template>
        <template v-else>Okutulan ürünler stoktan düşülür.</template>
      </p>

      <div class="relative mb-4">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <i class="fas fa-barcode absolute left-4 top-1/2 -translate-y-1/2 text-gold-primary" />
            <input
              ref="okutInput"
              v-model="okut"
              @keydown.enter.prevent="okutEnter"
              class="input-base pl-11 text-lg"
              placeholder="Barkod okutun veya ürün adı yazın… (3*barkod = 3 adet)"
              autocomplete="off"
            />
          </div>
          <input v-model.number="okutMiktar" type="number" min="0" step="0.01" class="input-base !w-24 text-center" title="Her okutmada eklenecek miktar" />
        </div>
        <div v-if="okutOneriler.length" class="absolute z-20 left-0 right-0 mt-1 glass-card p-1 max-h-72 overflow-auto">
          <button
            v-for="u in okutOneriler"
            :key="u.id"
            @mousedown.prevent="topluEkle(u, carpanliKod(okut).miktar)"
            class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-glass-hover text-left"
          >
            <span class="truncate">{{ u.ad }} <span class="text-xs text-pearl-50 font-mono">{{ u.barkod }}</span></span>
            <span class="text-xs text-pearl-60 tabular shrink-0">{{ u.stokTakibi ? `${Number(u.stok)} ${u.stokBirim}` : 'takip kapalı' }}</span>
          </button>
        </div>
      </div>

      <div class="glass-card overflow-x-auto mb-4">
        <EmptyState v-if="!topluListe.length" ikon="fa-barcode" baslik="Liste boş" aciklama="Ürün barkodlarını okutun" />
        <table v-else class="w-full text-sm">
          <thead class="text-xs text-pearl-50 uppercase">
            <tr class="border-b border-glass-border">
              <th class="text-left p-3">Ürün</th>
              <th class="text-right p-3">Fiyat</th>
              <th class="text-right p-3">Mevcut</th>
              <th class="text-right p-3">{{ topluTip === 'DUZELTME' ? 'Sayılan' : 'Miktar' }}</th>
              <th class="text-right p-3">Yeni stok</th>
              <th class="p-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in topluListe" :key="s.urun.id" class="border-b border-glass-border last:border-0">
              <td class="p-3">
                <div class="font-semibold">{{ s.urun.ad }}</div>
                <div class="text-xs text-pearl-50 font-mono">{{ s.urun.barkod }}</div>
              </td>
              <td class="p-3 text-right tabular">{{ paraFormat(s.urun.fiyat) }}</td>
              <td class="p-3 text-right tabular text-pearl-60">
                {{ s.urun.stokTakibi ? `${Number(s.urun.stok)} ${s.urun.stokBirim}` : 'takip kapalı' }}
              </td>
              <td class="p-3 text-right">
                <input v-model.number="s.miktar" type="number" min="0" step="0.01" class="input-base !w-24 !py-1.5 text-right" />
              </td>
              <td class="p-3 text-right font-semibold tabular gold-text">{{ Number(yeniStok(s).toFixed(3)) }} {{ s.urun.stokBirim }}</td>
              <td class="p-3 text-right">
                <button @click="topluListe.splice(i, 1)" class="text-pearl-60 hover:text-red-300 p-1"><i class="fas fa-xmark" /></button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="glass-card p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <input v-model="topluAciklama" class="input-base flex-1" placeholder="Açıklama (tedarikçi, fatura no, fire nedeni…)" />
        <label v-if="topluTip === 'GIRIS'" class="flex items-center gap-2 text-sm cursor-pointer shrink-0">
          <input v-model="sonraEtiket" type="checkbox" class="accent-gold-primary w-4 h-4" /> Sonra etiket bas
        </label>
        <button @click="topluListe = []" :disabled="!topluListe.length" class="btn-ghost !w-auto !py-2.5 !px-4 shrink-0">Temizle</button>
        <button @click="topluKaydet" :disabled="topluKaydediliyor || !topluListe.length" class="btn-gold !w-auto !py-2.5 !px-5 shrink-0">
          <i v-if="topluKaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          Stoğa İşle ({{ topluListe.length }})
        </button>
      </div>
    </template>

    <!-- Hareket Geçmişi -->
    <template v-else>
      <div v-if="yukleniyor" class="text-center py-12"><i class="fas fa-spinner fa-spin text-2xl text-pearl-60" /></div>

      <EmptyState v-else-if="!hareketler.length" ikon="fa-clock-rotate-left" baslik="Hareket yok" />

      <div v-else class="space-y-2">
        <div
          v-for="h in hareketler"
          :key="h.id"
          class="glass-card p-3 flex items-center gap-3"
        >
          <div
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            :class="`bg-${tipStil[h.tip]?.renk}-500/15 text-${tipStil[h.tip]?.renk}-300`"
          >
            <i :class="['fas', tipStil[h.tip]?.ikon]" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 text-sm">
              <span class="font-semibold">{{ h.urun.ad }}</span>
              <span :class="`text-${tipStil[h.tip]?.renk}-300 text-xs`">{{ tipStil[h.tip]?.ad }}</span>
            </div>
            <div class="text-xs text-pearl-50">
              {{ Number(h.oncesi) }} → {{ Number(h.sonrasi) }} {{ h.urun.stokBirim }}
              <span v-if="h.kullanici">· {{ h.kullanici.adSoyad }}</span>
              <span v-if="h.aciklama">· {{ h.aciklama }}</span>
            </div>
          </div>
          <div class="text-right text-xs text-pearl-50 shrink-0">
            <div :class="`font-bold text-${tipStil[h.tip]?.renk}-300`">
              {{ h.tip === 'GIRIS' || h.tip === 'IADE' ? '+' : (h.tip === 'DUZELTME' ? '=' : '−') }}{{ Number(h.miktar) }}
            </div>
            <div>{{ saatFormat(h.olusturuldu) }}</div>
          </div>
        </div>
      </div>
    </template>
  </template>

  <!-- Hareket Modal -->
  <AppModal :acik="modalAcik" :baslik="`Hareket: ${secilenUrun?.ad || ''}`" genislik="max-w-md" @kapat="modalAcik = false">
    <form @submit.prevent="hareketKaydet" class="space-y-4">
      <div class="text-center pb-3 border-b border-glass-border">
        <div class="text-xs text-pearl-50 uppercase tracking-wider">Mevcut Stok</div>
        <div class="text-3xl font-bold gold-text">
          {{ Number(secilenUrun?.stok || 0).toLocaleString('tr-TR') }} {{ secilenUrun?.stokBirim }}
        </div>
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">Hareket Tipi</label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="t in [
              { kod: 'GIRIS', ad: 'Giriş', ikon: 'fa-arrow-down', renk: 'emerald' },
              { kod: 'CIKIS', ad: 'Çıkış', ikon: 'fa-arrow-up', renk: 'red' },
              { kod: 'IADE', ad: 'İade', ikon: 'fa-rotate-left', renk: 'cyan' },
              { kod: 'FIRE', ad: 'Fire', ikon: 'fa-trash', renk: 'gray' },
              { kod: 'DUZELTME', ad: 'Düzelt', ikon: 'fa-pen', renk: 'amber' },
            ]"
            :key="t.kod"
            type="button"
            @click="form.tip = t.kod"
            :class="['p-3 rounded-xl border text-xs transition', form.tip === t.kod ? `bg-${t.renk}-500/15 border-${t.renk}-500/40 text-${t.renk}-300` : 'border-glass-border text-pearl-60']"
          >
            <i :class="['fas', t.ikon, 'block mb-1']" />{{ t.ad }}
          </button>
        </div>
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">
          {{ form.tip === 'DUZELTME' ? `Yeni Stok (${secilenUrun?.stokBirim})` : `Miktar (${secilenUrun?.stokBirim})` }}
        </label>
        <input v-model.number="form.miktar" type="number" min="0" step="0.01" required class="input-base text-lg font-semibold" />
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">Açıklama</label>
        <input v-model="form.aciklama" class="input-base" placeholder="Opsiyonel" />
      </div>

      <div class="flex gap-3 pt-2">
        <button type="button" @click="modalAcik = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">İptal</button>
        <button type="submit" :disabled="kaydediliyor || form.miktar <= 0" class="btn-gold flex-1">
          <i v-if="kaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          Uygula
        </button>
      </div>
    </form>
  </AppModal>

  <!-- Tanımsız barkod → hızlı ürün tanımla -->
  <AppModal :acik="yeniUrunModal" baslik="Yeni Ürün Tanımla" genislik="max-w-md" @kapat="yeniUrunModal = false">
    <form @submit.prevent="yeniUrunKaydet" class="space-y-4">
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Barkod</label>
        <input v-model="yeniUrun.barkod" class="input-base font-mono" readonly />
      </div>
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Ürün Adı *</label>
        <input v-model="yeniUrun.ad" required class="input-base" autofocus />
      </div>
      <div class="grid grid-cols-3 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Satış fiyatı ₺ *</label>
          <input v-model.number="yeniUrun.fiyat" type="number" min="0" step="0.01" required class="input-base" />
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Birim</label>
          <select v-model="yeniUrun.stokBirim" class="input-base">
            <option v-for="b in ['adet', 'kg', 'gr', 'lt', 'paket', 'koli']" :key="b">{{ b }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Giriş miktarı</label>
          <input v-model.number="yeniUrun.miktar" type="number" min="0" step="0.01" class="input-base" />
        </div>
      </div>
      <p class="text-xs text-pearl-50">Kategori, KDV gibi diğer bilgileri sonra Ürünler ekranından düzenleyebilirsin.</p>
      <div class="flex gap-3 pt-2">
        <button type="button" @click="yeniUrunModal = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">İptal</button>
        <button type="submit" class="btn-gold flex-1"><i class="fas fa-check mr-2" />Kaydet ve Ekle</button>
      </div>
    </form>
  </AppModal>
</template>
