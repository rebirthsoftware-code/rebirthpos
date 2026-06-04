<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

interface Kategori {
  id: string;
  subeId: string;
  ad: string;
  sira: number;
  renk?: string | null;
  ikon?: string | null;
  aktif: boolean;
  _count?: { urunler: number };
}

const sube = useSubeStore();
const kategoriler = ref<Kategori[]>([]);
const yukleniyor = ref(false);
const hata = ref('');

const modalAcik = ref(false);
const duzenlenen = ref<Kategori | null>(null);
const form = reactive({
  ad: '',
  sira: 0,
  renk: '#d4a017',
  ikon: 'fa-utensils',
  aktif: true,
});

const ikonSecenekleri = [
  'fa-utensils', 'fa-mug-hot', 'fa-pizza-slice', 'fa-burger', 'fa-ice-cream',
  'fa-wine-glass', 'fa-beer-mug-empty', 'fa-fish', 'fa-drumstick-bite', 'fa-bowl-rice',
  'fa-cake-candles', 'fa-cookie-bite', 'fa-bottle-water', 'fa-leaf', 'fa-pepper-hot',
];

const renkSecenekleri = [
  '#d4a017', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#64748b',
];

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  hata.value = '';
  try {
    kategoriler.value = await apiFetch<Kategori[]>(
      `/kategoriler?subeId=${sube.aktifSubeId}`,
    );
  } catch (e: any) {
    hata.value = e?.data?.message || 'Liste alınamadı';
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => listele(), { immediate: true });
onMounted(() => listele());

function yeniAc() {
  duzenlenen.value = null;
  Object.assign(form, {
    ad: '',
    sira: kategoriler.value.length,
    renk: '#d4a017',
    ikon: 'fa-utensils',
    aktif: true,
  });
  modalAcik.value = true;
}

function duzenleAc(k: Kategori) {
  duzenlenen.value = k;
  Object.assign(form, {
    ad: k.ad,
    sira: k.sira,
    renk: k.renk || '#d4a017',
    ikon: k.ikon || 'fa-utensils',
    aktif: k.aktif,
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
      sira: Number(form.sira),
      renk: form.renk,
      ikon: form.ikon,
      aktif: form.aktif,
    };
    if (duzenlenen.value) {
      await apiFetch(`/kategoriler/${duzenlenen.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/kategoriler', {
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

async function sil(k: Kategori) {
  if (!(await onay({
    baslik: 'Kategoriyi sil',
    mesaj: `${k.ad} kategorisi silinecek. Kategorideki ürünler kategorisiz kalır.`,
    onayMetni: 'Sil',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/kategoriler/${k.id}`, { method: 'DELETE' });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Silinemedi');
  }
}
</script>

<template>
  <PageHeader baslik="Kategoriler" aciklama="Ürün kategorilerini düzenle" ikon="fa-layer-group">
    <template #actions>
      <button @click="yeniAc" :disabled="!sube.aktifSubeId" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-plus mr-2" /> Yeni Kategori
      </button>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">
    <i class="fas fa-store text-3xl text-gold-primary/40 mb-3 block" />
    Önce bir şube seç
  </div>

  <div v-else-if="yukleniyor" class="text-center py-12 text-pearl-60">
    <i class="fas fa-spinner fa-spin text-2xl" />
  </div>

  <div v-else-if="hata" class="glass-card p-6 border-red-500/30 text-red-300">
    <i class="fas fa-exclamation-triangle mr-2" />{{ hata }}
  </div>

  <EmptyState
    v-else-if="!kategoriler.length"
    ikon="fa-layer-group"
    baslik="Henüz kategori yok"
    aciklama="İlk kategoriyi oluştur"
  >
    <button @click="yeniAc" class="btn-gold !w-auto !py-2.5 !px-5 inline-flex items-center">
      <i class="fas fa-plus mr-2" /> İlk Kategori
    </button>
  </EmptyState>

  <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
    <div
      v-for="k in kategoriler"
      :key="k.id"
      class="glass-card p-5 hover:scale-[1.02] hover:border-gold-primary/40 transition group relative overflow-hidden"
      :class="{ 'opacity-50': !k.aktif }"
    >
      <div
        class="absolute top-0 left-0 right-0 h-1"
        :style="{ background: k.renk || '#d4a017' }"
      />
      <div class="flex items-start justify-between mb-3">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
          :style="{ background: (k.renk || '#d4a017') + '22', color: k.renk || '#d4a017' }"
        >
          <i :class="['fas', k.ikon || 'fa-utensils']" />
        </div>
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button @click="duzenleAc(k)" class="text-pearl-60 hover:text-gold-primary p-1.5 rounded-lg hover:bg-pearl-5">
            <i class="fas fa-pen-to-square text-sm" />
          </button>
          <button @click="sil(k)" class="text-pearl-60 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10">
            <i class="fas fa-trash text-sm" />
          </button>
        </div>
      </div>
      <div class="font-semibold mb-1 truncate">{{ k.ad }}</div>
      <div class="text-xs text-pearl-50">
        {{ k._count?.urunler ?? 0 }} ürün
        <span v-if="!k.aktif" class="ml-2 text-red-400">• Pasif</span>
      </div>
    </div>
  </div>

  <AppModal
    :acik="modalAcik"
    :baslik="duzenlenen ? 'Kategoriyi Düzenle' : 'Yeni Kategori'"
    genislik="max-w-lg"
    @kapat="modalAcik = false"
  >
    <form @submit.prevent="kaydet" class="space-y-5">
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Kategori Adı *</label>
        <input v-model="form.ad" required class="input-base" placeholder="Örn: Sıcak İçecekler" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Sıra</label>
          <input v-model.number="form.sira" type="number" min="0" class="input-base" />
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Durum</label>
          <label class="input-base flex items-center gap-3 cursor-pointer">
            <input v-model="form.aktif" type="checkbox" class="accent-gold-primary w-4 h-4" />
            <span class="text-sm">{{ form.aktif ? 'Aktif' : 'Pasif' }}</span>
          </label>
        </div>
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">Renk</label>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="r in renkSecenekleri"
            :key="r"
            type="button"
            @click="form.renk = r"
            :class="['w-9 h-9 rounded-full border-2 transition', form.renk === r ? 'border-pearl scale-110 ring-2 ring-gold-primary/40' : 'border-transparent']"
            :style="{ background: r }"
          />
        </div>
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">İkon</label>
        <div class="grid grid-cols-8 gap-2">
          <button
            v-for="ik in ikonSecenekleri"
            :key="ik"
            type="button"
            @click="form.ikon = ik"
            :class="['w-10 h-10 rounded-xl flex items-center justify-center transition border', form.ikon === ik ? 'border-gold-primary bg-gold-primary/15 text-gold-primary' : 'border-glass-border text-pearl-60 hover:border-gold-primary/40']"
          >
            <i :class="['fas', ik]" />
          </button>
        </div>
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
