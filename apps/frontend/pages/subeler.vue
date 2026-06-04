<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

interface Firma {
  id: string;
  ad: string;
}

interface Sube {
  id: string;
  ad: string;
  adres?: string | null;
  telefon?: string | null;
  email?: string | null;
  aktif: boolean;
  firma: Firma;
  _count?: { masalar: number; urunler: number; kullanicilar: number };
}

const auth = useAuthStore();
const subeOlusturabilir = computed(
  () => auth.rol === 'SUPER_ADMIN' || auth.rol === 'FIRMA_ADMIN',
);

const subeler = ref<Sube[]>([]);
const firmalar = ref<Firma[]>([]);
const yukleniyor = ref(false);
const hata = ref('');

const modalAcik = ref(false);
const duzenlenen = ref<Sube | null>(null);
const form = reactive({
  firmaId: '',
  ad: '',
  adres: '',
  telefon: '',
  email: '',
  aktif: true,
});

async function listele() {
  yukleniyor.value = true;
  hata.value = '';
  try {
    subeler.value = await apiFetch<Sube[]>('/subeler');
    if (auth.rol === 'SUPER_ADMIN') {
      firmalar.value = await apiFetch<Firma[]>('/firmalar');
    }
  } catch (e: any) {
    hata.value = e?.data?.message || 'Liste alınamadı';
  } finally {
    yukleniyor.value = false;
  }
}

onMounted(() => listele());

function yeniAc() {
  duzenlenen.value = null;
  Object.assign(form, {
    firmaId: firmalar.value[0]?.id || '',
    ad: '',
    adres: '',
    telefon: '',
    email: '',
    aktif: true,
  });
  modalAcik.value = true;
}

function duzenleAc(s: Sube) {
  duzenlenen.value = s;
  Object.assign(form, {
    firmaId: s.firma.id,
    ad: s.ad,
    adres: s.adres || '',
    telefon: s.telefon || '',
    email: s.email || '',
    aktif: s.aktif,
  });
  modalAcik.value = true;
}

const kaydediliyor = ref(false);

async function kaydet() {
  kaydediliyor.value = true;
  try {
    const ortak = {
      ad: form.ad.trim(),
      adres: form.adres.trim() || undefined,
      telefon: form.telefon.trim() || undefined,
      email: form.email.trim() || undefined,
      aktif: form.aktif,
    };
    if (duzenlenen.value) {
      await apiFetch(`/subeler/${duzenlenen.value.id}`, { method: 'PATCH', body: ortak });
    } else {
      await apiFetch('/subeler', {
        method: 'POST',
        body: { ...ortak, firmaId: form.firmaId },
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

async function sil(s: Sube) {
  if (!(await onay({
    baslik: 'Şubeyi sil',
    mesaj: `${s.ad} şubesi ve tüm verileri (masa, ürün, adisyon) silinecek. Bu işlem geri alınamaz.`,
    onayMetni: 'Sil',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/subeler/${s.id}`, { method: 'DELETE' });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Silinemedi');
  }
}

// Firmaya göre grupla (super admin için)
const gruplu = computed(() => {
  const m = new Map<string, { firma: Firma; subeler: Sube[] }>();
  for (const s of subeler.value) {
    if (!m.has(s.firma.id)) m.set(s.firma.id, { firma: s.firma, subeler: [] });
    m.get(s.firma.id)!.subeler.push(s);
  }
  return Array.from(m.values());
});
</script>

<template>
  <PageHeader baslik="Şubeler" aciklama="Tüm şubeleri görüntüle ve yönet" ikon="fa-store">
    <template #actions>
      <button
        v-if="subeOlusturabilir && firmalar.length"
        @click="yeniAc"
        class="btn-gold !w-auto !py-2.5 !px-5"
      >
        <i class="fas fa-plus mr-2" /> Yeni Şube
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
    v-else-if="!subeler.length"
    ikon="fa-store"
    baslik="Henüz şube yok"
    :aciklama="
      auth.rol === 'SUPER_ADMIN' && !firmalar.length
        ? 'Önce bir firma oluştur, sonra şube ekle'
        : 'İlk şubeni oluşturarak başla'
    "
  >
    <button
      v-if="subeOlusturabilir && firmalar.length"
      @click="yeniAc"
      class="btn-gold !w-auto !py-2.5 !px-5 inline-flex items-center"
    >
      <i class="fas fa-plus mr-2" /> İlk Şubeyi Oluştur
    </button>
    <NuxtLink
      v-else-if="auth.rol === 'SUPER_ADMIN'"
      to="/firmalar"
      class="btn-gold !w-auto !py-2.5 !px-5 inline-flex items-center"
    >
      <i class="fas fa-building mr-2" /> Firmalar Sayfasına Git
    </NuxtLink>
  </EmptyState>

  <div v-else class="space-y-8">
    <div v-for="grup in gruplu" :key="grup.firma.id">
      <h2 class="text-sm uppercase tracking-widest text-gold-primary/70 mb-3 px-1">
        <i class="fas fa-building mr-2" />{{ grup.firma.ad }}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="s in grup.subeler"
          :key="s.id"
          class="glass-card p-6 hover:border-gold-primary/40 transition group"
          :class="{ 'opacity-60': !s.aktif }"
        >
          <div class="flex items-start justify-between mb-4">
            <div class="text-3xl text-gold-primary"><i class="fas fa-store" /></div>
            <div class="flex items-center gap-2">
              <span
                v-if="!s.aktif"
                class="text-[10px] uppercase bg-red-500/15 text-red-300 px-2 py-0.5 rounded-full"
              >Pasif</span>
              <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button
                  @click="duzenleAc(s)"
                  class="text-pearl-60 hover:text-gold-primary p-1.5 rounded-lg hover:bg-pearl-5"
                  title="Düzenle"
                >
                  <i class="fas fa-pen-to-square" />
                </button>
                <button
                  v-if="subeOlusturabilir"
                  @click="sil(s)"
                  class="text-pearl-60 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10"
                  title="Sil"
                >
                  <i class="fas fa-trash" />
                </button>
              </div>
            </div>
          </div>
          <h3 class="text-lg font-semibold mb-2">{{ s.ad }}</h3>
          <div class="space-y-1.5 text-sm text-pearl-60">
            <div v-if="s.adres"><i class="fas fa-location-dot w-4 text-gold-primary/60" /> {{ s.adres }}</div>
            <div v-if="s.telefon"><i class="fas fa-phone w-4 text-gold-primary/60" /> {{ s.telefon }}</div>
            <div v-if="s.email"><i class="fas fa-envelope w-4 text-gold-primary/60" /> {{ s.email }}</div>
          </div>
          <div class="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-glass-border text-center">
            <div>
              <div class="text-base font-semibold text-gold-primary">{{ s._count?.masalar ?? 0 }}</div>
              <div class="text-[10px] uppercase tracking-wider text-pearl-50">Masa</div>
            </div>
            <div>
              <div class="text-base font-semibold text-gold-primary">{{ s._count?.urunler ?? 0 }}</div>
              <div class="text-[10px] uppercase tracking-wider text-pearl-50">Ürün</div>
            </div>
            <div>
              <div class="text-base font-semibold text-gold-primary">{{ s._count?.kullanicilar ?? 0 }}</div>
              <div class="text-[10px] uppercase tracking-wider text-pearl-50">Personel</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <AppModal
    :acik="modalAcik"
    :baslik="duzenlenen ? 'Şubeyi Düzenle' : 'Yeni Şube'"
    genislik="max-w-lg"
    @kapat="modalAcik = false"
  >
    <form @submit.prevent="kaydet" class="space-y-4">
      <div v-if="!duzenlenen && auth.rol === 'SUPER_ADMIN'">
        <label class="block text-sm text-pearl-60 mb-2">Firma *</label>
        <select v-model="form.firmaId" required class="input-base">
          <option v-for="f in firmalar" :key="f.id" :value="f.id">{{ f.ad }}</option>
        </select>
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">Şube Adı *</label>
        <input v-model="form.ad" required class="input-base" placeholder="Örn: Merkez Şube" />
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">Adres</label>
        <input v-model="form.adres" class="input-base" placeholder="Cadde, no, ilçe, il" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Telefon</label>
          <input v-model="form.telefon" class="input-base" placeholder="0462 XXX XX XX" />
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">E-posta</label>
          <input v-model="form.email" type="email" class="input-base" placeholder="sube@firma.com" />
        </div>
      </div>

      <label class="flex items-center gap-3 cursor-pointer">
        <input v-model="form.aktif" type="checkbox" class="accent-gold-primary w-4 h-4" />
        <span class="text-sm text-pearl-70">Şube aktif</span>
      </label>

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
