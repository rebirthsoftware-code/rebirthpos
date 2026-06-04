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
      barkod: form.barkod.trim() || undefined,
      stokTakibi: form.stokTakibi,
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

          <div class="flex items-end justify-between mt-3 pt-3 border-t border-glass-border">
            <div class="text-xl font-bold gold-text">₺{{ Number(u.fiyat).toFixed(2) }}</div>
            <div class="flex gap-1.5">
              <span v-if="u.qrMenudeGoster" class="text-[10px] uppercase bg-blue-500/15 text-blue-300 px-2 py-0.5 rounded-full" title="QR menüde görünüyor">
                QR
              </span>
              <span v-if="u.stokTakibi" class="text-[10px] uppercase bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full">
                Stok
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
          <input v-model="form.barkod" class="input-base" placeholder="Opsiyonel" />
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
</template>
