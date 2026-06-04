<script setup lang="ts">
import { paraFormat, saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface Adisyon { id: string; numara: string; durum: string; toplamTutar: string | number; acilis: string }
interface Musteri {
  id: string;
  adSoyad: string;
  telefon: string;
  email?: string | null;
  adres?: string | null;
  notlar?: string | null;
  olusturuldu: string;
  guncellendi: string;
  adisyonlar?: Adisyon[];
}

const sube = useSubeStore();
const musteriler = ref<Musteri[]>([]);
const detay = ref<Musteri | null>(null);
const yukleniyor = ref(false);
const arama = ref('');

const modalAcik = ref(false);
const duzenlenen = ref<Musteri | null>(null);
const form = reactive({
  adSoyad: '',
  telefon: '',
  email: '',
  adres: '',
  notlar: '',
});

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const params = new URLSearchParams({ subeId: sube.aktifSubeId });
    if (arama.value.trim()) params.set('arama', arama.value.trim());
    musteriler.value = await apiFetch<Musteri[]>(`/musteriler?${params}`);
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => listele(), { immediate: true });
watch(arama, () => {
  // basit debounce
  clearTimeout((globalThis as any)._aramaT);
  (globalThis as any)._aramaT = setTimeout(listele, 300);
});

function yeniAc() {
  duzenlenen.value = null;
  Object.assign(form, { adSoyad: '', telefon: '', email: '', adres: '', notlar: '' });
  modalAcik.value = true;
}

function duzenleAc(m: Musteri) {
  duzenlenen.value = m;
  Object.assign(form, {
    adSoyad: m.adSoyad,
    telefon: m.telefon,
    email: m.email || '',
    adres: m.adres || '',
    notlar: m.notlar || '',
  });
  modalAcik.value = true;
}

const kaydediliyor = ref(false);

async function kaydet() {
  if (!sube.aktifSubeId) return;
  kaydediliyor.value = true;
  try {
    const payload: any = {
      adSoyad: form.adSoyad.trim(),
      telefon: form.telefon.trim(),
      email: form.email.trim() || undefined,
      adres: form.adres.trim() || undefined,
      notlar: form.notlar.trim() || undefined,
    };
    if (duzenlenen.value) {
      await apiFetch(`/musteriler/${duzenlenen.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/musteriler', { method: 'POST', body: { ...payload, subeId: sube.aktifSubeId } });
    }
    modalAcik.value = false;
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  } finally {
    kaydediliyor.value = false;
  }
}

async function detayAc(m: Musteri) {
  try {
    detay.value = await apiFetch<Musteri>(`/musteriler/${m.id}`);
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  }
}
</script>

<template>
  <PageHeader baslik="Müşteriler" aciklama="Müşteri rehberi ve geçmiş siparişler" ikon="fa-address-book">
    <template #actions>
      <button @click="yeniAc" :disabled="!sube.aktifSubeId" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-user-plus mr-2" /> Yeni Müşteri
      </button>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">Önce bir şube seç</div>

  <template v-else>
    <div class="relative mb-6">
      <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
      <input v-model="arama" class="input-base pl-11" placeholder="Ada veya telefona göre ara..." />
    </div>

    <div v-if="yukleniyor && !musteriler.length" class="text-center py-12 text-pearl-60">
      <i class="fas fa-spinner fa-spin text-2xl" />
    </div>

    <EmptyState v-else-if="!musteriler.length" ikon="fa-address-book" baslik="Müşteri bulunamadı" />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <div
        v-for="m in musteriler"
        :key="m.id"
        @click="detayAc(m)"
        class="glass-card p-4 hover:border-gold-primary/40 transition cursor-pointer group"
      >
        <div class="flex items-start justify-between mb-2">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-2xl bg-gold-primary/15 text-gold-primary flex items-center justify-center">
              <i class="fas fa-user" />
            </div>
            <div>
              <div class="font-semibold leading-tight">{{ m.adSoyad }}</div>
              <div class="text-xs text-pearl-50">{{ m.telefon }}</div>
            </div>
          </div>
          <button @click.stop="duzenleAc(m)" class="opacity-0 group-hover:opacity-100 transition text-pearl-60 hover:text-gold-primary p-1.5">
            <i class="fas fa-pen-to-square" />
          </button>
        </div>
        <div v-if="m.adres" class="text-xs text-pearl-50 line-clamp-2">
          <i class="fas fa-location-dot mr-1 text-gold-primary/60" />{{ m.adres }}
        </div>
      </div>
    </div>
  </template>

  <!-- Müşteri Detay Modal -->
  <AppModal :acik="!!detay" :baslik="detay?.adSoyad" genislik="max-w-2xl" @kapat="detay = null">
    <div v-if="detay" class="space-y-5">
      <div class="grid grid-cols-2 gap-4 text-sm">
        <div>
          <div class="text-pearl-50 text-xs mb-1">Telefon</div>
          <div>{{ detay.telefon }}</div>
        </div>
        <div v-if="detay.email">
          <div class="text-pearl-50 text-xs mb-1">E-posta</div>
          <div>{{ detay.email }}</div>
        </div>
        <div v-if="detay.adres" class="col-span-2">
          <div class="text-pearl-50 text-xs mb-1">Adres</div>
          <div>{{ detay.adres }}</div>
        </div>
        <div v-if="detay.notlar" class="col-span-2">
          <div class="text-pearl-50 text-xs mb-1">Notlar</div>
          <div class="text-pearl-70">{{ detay.notlar }}</div>
        </div>
      </div>

      <div v-if="detay.adisyonlar?.length">
        <h4 class="text-sm font-semibold text-gold-primary mb-2">Geçmiş Adisyonlar</h4>
        <div class="space-y-2 max-h-72 overflow-y-auto">
          <NuxtLink
            v-for="a in detay.adisyonlar"
            :key="a.id"
            :to="`/adisyon/${a.id}`"
            class="glass-card p-3 flex items-center justify-between hover:bg-glass-hover transition"
          >
            <div>
              <div class="text-sm font-medium">{{ a.numara }}</div>
              <div class="text-[11px] text-pearl-50">{{ saatFormat(a.acilis) }} · {{ a.durum }}</div>
            </div>
            <div class="font-bold gold-text">{{ paraFormat(a.toplamTutar) }}</div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </AppModal>

  <AppModal :acik="modalAcik" :baslik="duzenlenen ? 'Müşteriyi Düzenle' : 'Yeni Müşteri'" genislik="max-w-lg" @kapat="modalAcik = false">
    <form @submit.prevent="kaydet" class="space-y-4">
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Ad Soyad *</label>
        <input v-model="form.adSoyad" required class="input-base" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Telefon *</label>
          <input v-model="form.telefon" required class="input-base" placeholder="05XX XXX XX XX" />
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">E-posta</label>
          <input v-model="form.email" type="email" class="input-base" />
        </div>
      </div>
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Adres</label>
        <textarea v-model="form.adres" rows="2" class="input-base resize-none" />
      </div>
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Notlar</label>
        <textarea v-model="form.notlar" rows="2" class="input-base resize-none" placeholder="Tercihler, alerjiler, vb." />
      </div>

      <div class="flex gap-3 pt-2">
        <button type="button" @click="modalAcik = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">İptal</button>
        <button type="submit" :disabled="kaydediliyor" class="btn-gold flex-1">
          <i v-if="kaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          Kaydet
        </button>
      </div>
    </form>
  </AppModal>
</template>
