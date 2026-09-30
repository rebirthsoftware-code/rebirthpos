<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

interface Kategori {
  id: string;
  ad: string;
  renk?: string | null;
}

interface Urun {
  id: string;
  subeId: string;
  kategoriId?: string | null;
  ad: string;
  aciklama?: string | null;
  fiyat: string | number;
  kdvOrani: string | number;
  resimUrl?: string | null;
  barkod?: string | null;
  stokTakibi: boolean;
  stok?: string | number;
  stokBirim?: string;
  stokUyariEsigi?: string | number;
  aktif: boolean;
  qrMenudeGoster: boolean;
  kategori?: Kategori | null;
}

const sube = useSubeStore();
const urunler = ref<Urun[]>([]);
const kategoriler = ref<Kategori[]>([]);
const yukleniyor = ref(false);
const hata = ref('');
const arama = ref('');
const aktifKategori = ref<string>('');

const modalAcik = ref(false);
const duzenlenen = ref<Urun | null>(null);
const form = reactive({
  ad: '',
  aciklama: '',
  fiyat: 0,
  kdvOrani: 10,
  kategoriId: '',
  resimUrl: '',
  barkod: '',
  stokTakibi: false,
  stokBirim: 'adet',
  stokUyariEsigi: 0,
  aktif: true,
  qrMenudeGoster: true,
});

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  hata.value = '';
  try {
    const [u, k] = await Promise.all([
      apiFetch<Urun[]>(`/urunler?subeId=${sube.aktifSubeId}`),
      apiFetch<Kategori[]>(`/kategoriler?subeId=${sube.aktifSubeId}`),
    ]);
    urunler.value = u;
    kategoriler.value = k;
  } catch (e: any) {
    hata.value = e?.data?.message || 'Liste alınamadı';
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => listele(), { immediate: true });
onMounted(() => listele());

const filtreli = computed(() => {
  let liste = urunler.value;
  if (aktifKategori.value) {
    liste = liste.filter((u) => u.kategoriId === aktifKategori.value);
  }
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    liste = liste.filter(
      (u) =>
        u.ad.toLocaleLowerCase('tr').includes(q) ||
        u.barkod?.toLocaleLowerCase('tr').includes(q),
    );
  }
  return liste;
});

function yeniAc() {
  duzenlenen.value = null;
  Object.assign(form, {
    ad: '',
    aciklama: '',
    fiyat: 0,
    kdvOrani: 10,
    kategoriId: aktifKategori.value || kategoriler.value[0]?.id || '',
    resimUrl: '',
    barkod: '',
    stokTakibi: false,
    stokBirim: 'adet',
    stokUyariEsigi: 0,
    aktif: true,
    qrMenudeGoster: true,
  });
  modalAcik.value = true;
}

function duzenleAc(u: Urun) {
  duzenlenen.value = u;
  Object.assign(form, {
    ad: u.ad,
    aciklama: u.aciklama || '',
    fiyat: Number(u.fiyat),
    kdvOrani: Number(u.kdvOrani),
    kategoriId: u.kategoriId || '',
    resimUrl: u.resimUrl || '',
    barkod: u.barkod || '',
    stokTakibi: u.stokTakibi,
    stokBirim: u.stokBirim || 'adet',
    stokUyariEsigi: Number(u.stokUyariEsigi || 0),
    aktif: u.aktif,
    qrMenudeGoster: u.qrMenudeGoster,
  });
  modalAcik.value = true;
}

const kaydediliyor = ref(false);

async function kaydet() {
  if (!sube.aktifSubeId) return;
  kaydediliyor.value = true;
  try {
    const payload: any = {
      ad: form.ad.trim(),
      aciklama: form.aciklama.trim() || undefined,
      fiyat: Number(form.fiyat),
      kdvOrani: Number(form.kdvOrani),
      kategoriId: form.kategoriId || undefined,
      resimUrl: form.resimUrl.trim() || undefined,
      // Düzenlemede boş barkod = barkodu kaldır
      barkod: form.barkod.trim() || (duzenlenen.value ? null : undefined),
      stokTakibi: form.stokTakibi,
      stokBirim: form.stokBirim,
      stokUyariEsigi: Number(form.stokUyariEsigi) || 0,
      aktif: form.aktif,
      qrMenudeGoster: form.qrMenudeGoster,
    };
    if (duzenlenen.value) {
      await apiFetch(`/urunler/${duzenlenen.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/urunler', {
        method: 'POST',
        body: { ...payload, subeId: sube.aktifSubeId },
      });
    }
    modalAcik.value = false;
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Kaydedilemedi');
  } finally {
    kaydediliyor.value = false;
  }
}

const { onay } = useOnay();
const etiket = useEtiket();

async function barkodUret() {
  if (!sube.aktifSubeId) return;
  try {
    const r = await apiFetch<{ barkod: string }>(`/urunler/yeni-barkod?subeId=${sube.aktifSubeId}`);
    form.barkod = r.barkod;
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Barkod üretilemedi');
  }
}

// ─── Barkod atama ───
// Tek ürün: kartta "Barkod ekle" → okut ya da üret
const barkodModal = ref(false);
const barkodUrun = ref<Urun | null>(null);
const barkodDeger = ref('');
const barkodEtiketeEkle = ref(true);
const barkodKaydediliyor = ref(false);

function barkodEkleAc(u: Urun) {
  barkodUrun.value = u;
  barkodDeger.value = '';
  barkodModal.value = true;
}

async function barkodDegerUret() {
  if (!sube.aktifSubeId) return;
  try {
    barkodDeger.value = (await apiFetch<{ barkod: string }>(`/urunler/yeni-barkod?subeId=${sube.aktifSubeId}`)).barkod;
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Barkod üretilemedi');
  }
}

async function barkodAta(u: Urun, barkod: string) {
  const guncel = await apiFetch<Urun>(`/urunler/${u.id}`, { method: 'PATCH', body: { barkod: barkod.trim() } });
  const i = urunler.value.findIndex((x) => x.id === u.id);
  if (i >= 0) urunler.value[i] = { ...urunler.value[i], barkod: guncel.barkod };
  return guncel;
}

async function barkodKaydet() {
  if (!barkodUrun.value || !barkodDeger.value.trim()) return;
  barkodKaydediliyor.value = true;
  try {
    const guncel = await barkodAta(barkodUrun.value, barkodDeger.value);
    if (barkodEtiketeEkle.value) etiket.ekle({ ...barkodUrun.value, barkod: guncel.barkod });
    useToastStore().basari(`${barkodUrun.value.ad}: barkod eklendi`);
    barkodModal.value = false;
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Barkod kaydedilemedi');
  } finally {
    barkodKaydediliyor.value = false;
  }
}

// Toplu: barkodu olmayan ürünlere sırayla okut (Enter → kaydet, sonraki satıra geç)
const barkodsuzlar = computed(() => urunler.value.filter((u) => !u.barkod));
const topluBarkodModal = ref(false);
const topluBarkodlar = reactive<Record<string, string>>({});
const topluIslemde = ref(false);

function topluBarkodAc() {
  for (const k of Object.keys(topluBarkodlar)) delete topluBarkodlar[k];
  topluBarkodModal.value = true;
  nextTick(() => (document.querySelector('[data-barkod-input]') as HTMLInputElement | null)?.focus());
}

async function topluSatirKaydet(u: Urun, ev?: KeyboardEvent) {
  const deger = topluBarkodlar[u.id]?.trim();
  if (!deger) return;
  const sonraki = (ev?.target as HTMLElement | undefined)?.closest('tr')?.nextElementSibling?.querySelector('input') as HTMLInputElement | null;
  try {
    await barkodAta(u, deger);
    delete topluBarkodlar[u.id];
    useToastStore().basari(`${u.ad}: barkod eklendi`);
    nextTick(() => (sonraki?.isConnected ? sonraki : document.querySelector('[data-barkod-input]') as HTMLInputElement | null)?.focus());
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Barkod kaydedilemedi');
  }
}

async function hepsineBarkodUret() {
  if (!sube.aktifSubeId || !barkodsuzlar.value.length) return;
  if (!(await onay({
    baslik: 'Hepsine barkod üret',
    mesaj: `Barkodu olmayan ${barkodsuzlar.value.length} ürüne mağaza içi barkod verilecek. Ürünün kendi (üretici) barkodu varsa önce onu okutmanız daha iyi olur.`,
    onayMetni: 'Üret',
  }))) return;
  topluIslemde.value = true;
  try {
    const r = await apiFetch<{ guncellenen: number }>('/urunler/barkodsuzlara-uret', { method: 'POST', body: { subeId: sube.aktifSubeId } });
    useToastStore().basari(`${r.guncellenen} ürüne barkod verildi`);
    topluBarkodModal.value = false;
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Barkodlar üretilemedi');
  } finally {
    topluIslemde.value = false;
  }
}

function etiketeEkle(u: Urun) {
  if (etiket.ekle(u)) useToastStore().basari(`${u.ad} etiket kuyruğuna eklendi`);
}

async function sil(u: Urun) {
  if (!(await onay({
    baslik: 'Ürünü sil',
    mesaj: `${u.ad} silinecek. Geçmiş adisyonlardaki satır kayıtları korunur.`,
    onayMetni: 'Sil',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/urunler/${u.id}`, { method: 'DELETE' });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Silinemedi');
  }
}

const sayilar = computed(() => {
  const m: Record<string, number> = { '': urunler.value.length };
  for (const u of urunler.value) {
    if (u.kategoriId) m[u.kategoriId] = (m[u.kategoriId] || 0) + 1;
  }
  return m;
});
</script>

<template>
  <PageHeader baslik="Ürünler" aciklama="Menü ürünlerini yönet" ikon="fa-utensils">
    <template #actions>
      <button
        v-if="barkodsuzlar.length"
        @click="topluBarkodAc"
        class="btn-ghost !w-auto !py-2.5 !px-4"
        title="Barkodu olmayan ürünlere barkod ver"
      >
        <i class="fas fa-barcode mr-2" /> Barkodsuz ürünler ({{ barkodsuzlar.length }})
      </button>
      <button @click="yeniAc" :disabled="!sube.aktifSubeId" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-plus mr-2" /> Yeni Ürün
      </button>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">
    Önce bir şube seç
  </div>

  <template v-else>
    <!-- Filtre Çubuğu -->
    <div class="flex flex-col md:flex-row gap-3 mb-6">
      <div class="relative flex-1">
        <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
        <input
          v-model="arama"
          placeholder="Ürün ara (ad veya barkod)..."
          class="input-base pl-11"
        />
      </div>
    </div>

    <!-- Kategori Sekmeleri -->
    <div class="flex flex-wrap gap-2 mb-6 -mx-1">
      <button
        @click="aktifKategori = ''"
        :class="['px-4 py-2 rounded-xl text-sm transition border', aktifKategori === '' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60 hover:text-pearl']"
      >
        Tümü
        <span class="ml-1.5 text-xs opacity-70">{{ sayilar[''] || 0 }}</span>
      </button>
      <button
        v-for="k in kategoriler"
        :key="k.id"
        @click="aktifKategori = k.id"
        :class="['px-4 py-2 rounded-xl text-sm transition border flex items-center gap-2', aktifKategori === k.id ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60 hover:text-pearl']"
      >
        <span v-if="k.renk" class="w-2 h-2 rounded-full" :style="{ background: k.renk }" />
        {{ k.ad }}
        <span class="text-xs opacity-70">{{ sayilar[k.id] || 0 }}</span>
      </button>
    </div>

    <div v-if="yukleniyor" class="text-center py-12 text-pearl-60">
      <i class="fas fa-spinner fa-spin text-2xl" />
    </div>

    <EmptyState
      v-else-if="!filtreli.length"
      ikon="fa-utensils"
      :baslik="urunler.length ? 'Filtreye uyan ürün yok' : 'Henüz ürün yok'"
      :aciklama="urunler.length ? 'Aramayı veya kategoriyi değiştir' : 'Önce kategorileri oluştur, sonra ürün ekle'"
    />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <div
        v-for="u in filtreli"
        :key="u.id"
        class="glass-card overflow-hidden hover:border-gold-primary/40 transition group"
        :class="{ 'opacity-60': !u.aktif }"
      >
        <div
          v-if="u.resimUrl"
          class="aspect-video bg-bg-dark/50 bg-cover bg-center"
          :style="{ backgroundImage: `url('${u.resimUrl}')` }"
        />
        <div v-else class="aspect-video bg-bg-dark/50 flex items-center justify-center text-4xl text-gold-primary/30">
          <i class="fas fa-utensils" />
        </div>

        <div class="p-4">
          <div class="flex items-start justify-between gap-2 mb-1">
            <h3 class="font-semibold leading-snug">{{ u.ad }}</h3>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
              <button v-if="u.barkod" @click="etiketeEkle(u)" class="text-pearl-60 hover:text-gold-primary p-1 rounded hover:bg-pearl-5" title="Etiket kuyruğuna ekle">
                <i class="fas fa-barcode text-sm" />
              </button>
              <button @click="duzenleAc(u)" class="text-pearl-60 hover:text-gold-primary p-1 rounded hover:bg-pearl-5">
                <i class="fas fa-pen-to-square text-sm" />
              </button>
              <button @click="sil(u)" class="text-pearl-60 hover:text-red-300 p-1 rounded hover:bg-red-500/10">
                <i class="fas fa-trash text-sm" />
              </button>
            </div>
          </div>

          <div v-if="u.kategori" class="flex items-center gap-1.5 text-[11px] text-pearl-50 mb-2">
            <span v-if="u.kategori.renk" class="w-1.5 h-1.5 rounded-full" :style="{ background: u.kategori.renk }" />
            {{ u.kategori.ad }}
          </div>
          <div v-if="u.barkod" class="text-[11px] text-pearl-50 font-mono mb-1">{{ u.barkod }}</div>
          <button
            v-else
            @click="barkodEkleAc(u)"
            class="text-[11px] text-gold-primary hover:underline mb-1"
          >
            <i class="fas fa-barcode mr-1" />Barkod ekle
          </button>

          <div class="flex items-end justify-between mt-3 pt-3 border-t border-glass-border">
            <div class="text-xl font-bold gold-text">₺{{ Number(u.fiyat).toFixed(2) }}</div>
            <div class="flex gap-1.5">
              <span v-if="u.qrMenudeGoster" class="text-[10px] uppercase bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full" title="QR menüde görünüyor">
                QR
              </span>
              <span
                v-if="u.stokTakibi"
                :class="['text-[10px] px-2 py-0.5 rounded-full tabular', Number(u.stok) <= Number(u.stokUyariEsigi || 0) ? 'bg-red-500/15 text-red-300' : 'bg-purple-500/15 text-purple-300']"
                title="Eldeki stok"
              >
                {{ Number(u.stok || 0) }} {{ u.stokBirim }}
              </span>
              <span v-if="!u.aktif" class="text-[10px] uppercase bg-red-500/15 text-red-300 px-2 py-0.5 rounded-full">
                Pasif
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </template>

  <AppModal
    :acik="modalAcik"
    :baslik="duzenlenen ? 'Ürünü Düzenle' : 'Yeni Ürün'"
    genislik="max-w-2xl"
    @kapat="modalAcik = false"
  >
    <form @submit.prevent="kaydet" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="md:col-span-2">
          <label class="block text-sm text-pearl-60 mb-2">Ürün Adı *</label>
          <input v-model="form.ad" required class="input-base" placeholder="Örn: Türk Kahvesi" />
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm text-pearl-60 mb-2">Açıklama</label>
          <textarea v-model="form.aciklama" rows="2" class="input-base resize-none" placeholder="Kısa açıklama (opsiyonel)" />
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">Kategori</label>
          <select v-model="form.kategoriId" class="input-base">
            <option value="">— Yok —</option>
            <option v-for="k in kategoriler" :key="k.id" :value="k.id">{{ k.ad }}</option>
          </select>
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">Barkod</label>
          <div class="flex gap-2">
            <input v-model="form.barkod" class="input-base font-mono" placeholder="Okutun veya üretin" @keydown.enter.prevent />
            <button type="button" @click="barkodUret" class="glass-card px-3 text-xs hover:bg-glass-hover transition shrink-0" title="Mağaza içi barkod üret">
              <i class="fas fa-wand-magic-sparkles mr-1" />Üret
            </button>
          </div>
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">Fiyat (₺) *</label>
          <input v-model.number="form.fiyat" type="number" min="0" step="0.01" required class="input-base" />
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">KDV Oranı (%)</label>
          <input v-model.number="form.kdvOrani" type="number" min="0" max="100" step="0.5" class="input-base" />
        </div>

        <div class="md:col-span-2">
          <label class="block text-sm text-pearl-60 mb-2">Resim URL</label>
          <input v-model="form.resimUrl" class="input-base" placeholder="https://..." />
        </div>
      </div>

      <div class="grid grid-cols-3 gap-3 pt-2">
        <label class="input-base flex items-center gap-2 cursor-pointer">
          <input v-model="form.aktif" type="checkbox" class="accent-gold-primary w-4 h-4" />
          <span class="text-sm">Aktif</span>
        </label>
        <label class="input-base flex items-center gap-2 cursor-pointer">
          <input v-model="form.qrMenudeGoster" type="checkbox" class="accent-gold-primary w-4 h-4" />
          <span class="text-sm">QR Menüde</span>
        </label>
        <label class="input-base flex items-center gap-2 cursor-pointer">
          <input v-model="form.stokTakibi" type="checkbox" class="accent-gold-primary w-4 h-4" />
          <span class="text-sm">Stok Takip</span>
        </label>
      </div>

      <div v-if="form.stokTakibi" class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Stok Birimi</label>
          <select v-model="form.stokBirim" class="input-base">
            <option v-for="b in ['adet', 'kg', 'gr', 'lt', 'porsiyon', 'paket', 'koli']" :key="b">{{ b }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Kritik Stok Uyarısı</label>
          <input v-model.number="form.stokUyariEsigi" type="number" min="0" step="0.01" class="input-base" />
        </div>
        <p class="col-span-2 text-xs text-pearl-50 -mt-2">Stok miktarı Stok ekranından (Barkodla İşlem / Hareket) girilir; satışta otomatik düşer.</p>
      </div>

      <div class="flex gap-3 pt-2">
        <button type="button" @click="modalAcik = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">
          İptal
        </button>
        <button type="submit" :disabled="kaydediliyor" class="btn-gold flex-1">
          <i v-if="kaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          {{ kaydediliyor ? 'Kaydediliyor...' : 'Kaydet' }}
        </button>
      </div>
    </form>
  </AppModal>

  <!-- Tek ürüne barkod ekle -->
  <AppModal :acik="barkodModal" :baslik="`Barkod ekle: ${barkodUrun?.ad || ''}`" genislik="max-w-md" @kapat="barkodModal = false">
    <form @submit.prevent="barkodKaydet" class="space-y-4">
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Barkod</label>
        <div class="flex gap-2">
          <input
            v-model="barkodDeger"
            class="input-base font-mono text-lg"
            placeholder="Ürünün barkodunu okutun"
            autocomplete="off"
            autofocus
          />
          <button type="button" @click="barkodDegerUret" class="glass-card px-3 text-xs hover:bg-glass-hover transition shrink-0">
            <i class="fas fa-wand-magic-sparkles mr-1" />Üret
          </button>
        </div>
        <p class="text-xs text-pearl-50 mt-2">
          Ürünün üzerinde barkod varsa okutun. Yoksa <b>Üret</b> ile mağaza içi barkod verin ve etiketini basın.
        </p>
      </div>
      <label class="flex items-center gap-2 text-sm cursor-pointer">
        <input v-model="barkodEtiketeEkle" type="checkbox" class="accent-gold-primary w-4 h-4" /> Etiket kuyruğuna da ekle
      </label>
      <div class="flex gap-3 pt-2">
        <button type="button" @click="barkodModal = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">İptal</button>
        <button type="submit" :disabled="barkodKaydediliyor || !barkodDeger.trim()" class="btn-gold flex-1">
          <i v-if="barkodKaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />Kaydet
        </button>
      </div>
    </form>
  </AppModal>

  <!-- Barkodsuz ürünlere toplu barkod -->
  <AppModal :acik="topluBarkodModal" baslik="Barkodsuz Ürünler" genislik="max-w-2xl" @kapat="topluBarkodModal = false">
    <p class="text-sm text-pearl-60 mb-4">
      Sırayla her ürünün barkodunu okutun; okuyucu Enter'a basınca kaydedilir ve sonraki satıra geçilir.
      Barkodu olmayan ürünler için alttaki butonla toplu barkod üretebilirsiniz.
    </p>
    <div v-if="!barkodsuzlar.length" class="text-center py-8 text-pearl-60">
      <i class="fas fa-circle-check text-3xl text-emerald-400 mb-2 block" />Tüm ürünlerin barkodu var
    </div>
    <div v-else class="max-h-[55vh] overflow-auto -mx-2 px-2">
      <table class="w-full text-sm">
        <tbody>
          <tr v-for="u in barkodsuzlar" :key="u.id" class="border-b border-glass-border last:border-0">
            <td class="py-2 pr-3">
              <div class="font-medium">{{ u.ad }}</div>
              <div v-if="u.kategori" class="text-xs text-pearl-50">{{ u.kategori.ad }}</div>
            </td>
            <td class="py-2 w-64">
              <input
                v-model="topluBarkodlar[u.id]"
                data-barkod-input
                @keydown.enter.prevent="topluSatirKaydet(u, $event)"
                class="input-base font-mono !py-2"
                placeholder="Barkodu okutun"
                autocomplete="off"
              />
            </td>
            <td class="py-2 pl-2 w-10 text-right">
              <button @click="topluSatirKaydet(u)" :disabled="!topluBarkodlar[u.id]?.trim()" class="text-pearl-60 hover:text-gold-primary p-1 disabled:opacity-30" title="Kaydet">
                <i class="fas fa-check" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="flex gap-3 pt-4">
      <button @click="topluBarkodModal = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">Kapat</button>
      <button @click="hepsineBarkodUret" :disabled="topluIslemde || !barkodsuzlar.length" class="btn-gold flex-1">
        <i v-if="topluIslemde" class="fas fa-spinner fa-spin mr-2" />
        <i v-else class="fas fa-wand-magic-sparkles mr-2" />Kalan {{ barkodsuzlar.length }} ürüne barkod üret
      </button>
    </div>
  </AppModal>
</template>
