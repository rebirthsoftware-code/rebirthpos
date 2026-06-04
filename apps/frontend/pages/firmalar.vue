<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

interface Firma {
  id: string;
  ad: string;
  vergiNo?: string | null;
  vergiDairesi?: string | null;
  paraBirimi: string;
  kdvOrani: string | number;
  logoUrl?: string | null;
  olusturuldu: string;
  _count?: { subeler: number };
}

const auth = useAuthStore();
if (auth.rol !== 'SUPER_ADMIN') {
  throw createError({ statusCode: 403, statusMessage: 'Yetkisiz' });
}

const firmalar = ref<Firma[]>([]);
const yukleniyor = ref(false);
const hata = ref('');

const modalAcik = ref(false);
const duzenlenen = ref<Firma | null>(null);
const form = reactive({
  ad: '',
  vergiNo: '',
  vergiDairesi: '',
  paraBirimi: 'TRY',
  kdvOrani: 10,
});

async function listele() {
  yukleniyor.value = true;
  hata.value = '';
  try {
    firmalar.value = await apiFetch<Firma[]>('/firmalar');
  } catch (e: any) {
    hata.value = e?.data?.message || 'Liste alınamadı';
  } finally {
    yukleniyor.value = false;
  }
}

onMounted(() => listele());

function yeniAc() {
  duzenlenen.value = null;
  Object.assign(form, { ad: '', vergiNo: '', vergiDairesi: '', paraBirimi: 'TRY', kdvOrani: 10 });
  modalAcik.value = true;
}

function duzenleAc(f: Firma) {
  duzenlenen.value = f;
  Object.assign(form, {
    ad: f.ad,
    vergiNo: f.vergiNo || '',
    vergiDairesi: f.vergiDairesi || '',
    paraBirimi: f.paraBirimi,
    kdvOrani: Number(f.kdvOrani),
  });
  modalAcik.value = true;
}

const kaydediliyor = ref(false);

async function kaydet() {
  kaydediliyor.value = true;
  try {
    const payload = {
      ad: form.ad.trim(),
      vergiNo: form.vergiNo.trim() || undefined,
      vergiDairesi: form.vergiDairesi.trim() || undefined,
      paraBirimi: form.paraBirimi,
      kdvOrani: Number(form.kdvOrani),
    };
    if (duzenlenen.value) {
      await apiFetch(`/firmalar/${duzenlenen.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/firmalar', { method: 'POST', body: payload });
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

async function sil(f: Firma) {
  if (!(await onay({
    baslik: 'Firmayı sil',
    mesaj: `${f.ad} firması ve tüm şubeleri silinecek. Bu işlem geri alınamaz.`,
    onayMetni: 'Sil',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/firmalar/${f.id}`, { method: 'DELETE' });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Silinemedi');
  }
}
</script>

<template>
  <PageHeader baslik="Firmalar" aciklama="Sistemdeki tüm firmaları yönet" ikon="fa-building">
    <template #actions>
      <button @click="yeniAc" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-plus mr-2" /> Yeni Firma
      </button>
    </template>
  </PageHeader>

  <div v-if="yukleniyor" class="text-center py-12 text-pearl-60">
    <i class="fas fa-spinner fa-spin text-2xl" />
  </div>

  <div v-else-if="hata" class="glass-card p-6 border-red-500/30 text-red-300">
    <i class="fas fa-exclamation-triangle mr-2" />{{ hata }}
  </div>

  <EmptyState
    v-else-if="!firmalar.length"
    ikon="fa-building"
    baslik="Henüz firma yok"
    aciklama="İlk firmanı oluşturarak başla"
  >
    <button @click="yeniAc" class="btn-gold !w-auto !py-2.5 !px-5 inline-flex items-center">
      <i class="fas fa-plus mr-2" /> İlk Firmayı Oluştur
    </button>
  </EmptyState>

  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div
      v-for="f in firmalar"
      :key="f.id"
      class="glass-card p-6 hover:border-gold-primary/40 transition group"
    >
      <div class="flex items-start justify-between mb-4">
        <div class="text-3xl text-gold-primary">
          <i class="fas fa-building" />
        </div>
        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
          <button
            @click="duzenleAc(f)"
            class="text-pearl-60 hover:text-gold-primary p-1.5 rounded-lg hover:bg-pearl-5"
            title="Düzenle"
          >
            <i class="fas fa-pen-to-square" />
          </button>
          <button
            @click="sil(f)"
            class="text-pearl-60 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10"
            title="Sil"
          >
            <i class="fas fa-trash" />
          </button>
        </div>
      </div>
      <h3 class="text-lg font-semibold mb-2">{{ f.ad }}</h3>
      <div class="space-y-1.5 text-sm text-pearl-60">
        <div v-if="f.vergiNo"><i class="fas fa-id-card w-4 text-gold-primary/60" /> VKN: {{ f.vergiNo }}</div>
        <div><i class="fas fa-coins w-4 text-gold-primary/60" /> {{ f.paraBirimi }} / KDV %{{ f.kdvOrani }}</div>
        <div><i class="fas fa-store w-4 text-gold-primary/60" /> {{ f._count?.subeler ?? 0 }} şube</div>
      </div>
    </div>
  </div>

  <AppModal
    :acik="modalAcik"
    :baslik="duzenlenen ? 'Firmayı Düzenle' : 'Yeni Firma'"
    genislik="max-w-lg"
    @kapat="modalAcik = false"
  >
    <form @submit.prevent="kaydet" class="space-y-4">
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Firma Adı *</label>
        <input v-model="form.ad" required class="input-base" placeholder="Örn: Rebirth Restoran" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Vergi No</label>
          <input v-model="form.vergiNo" class="input-base" placeholder="1234567890" />
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Vergi Dairesi</label>
          <input v-model="form.vergiDairesi" class="input-base" placeholder="Trabzon" />
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Para Birimi</label>
          <select v-model="form.paraBirimi" class="input-base">
            <option value="TRY">₺ TRY</option>
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">KDV Oranı (%)</label>
          <input v-model.number="form.kdvOrani" type="number" min="0" max="100" step="0.5" class="input-base" />
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
