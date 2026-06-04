<script setup lang="ts">
import { paraFormat, gecenSure, saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface AdisyonOzet {
  id: string;
  numara: string;
  durum: string;
  araToplam: string | number;
  iskontoTutar: string | number;
  toplamTutar: string | number;
  acilis: string;
  masa?: { id: string; ad: string } | null;
  acanKullanici: { id: string; adSoyad: string };
  _count?: { siparisler: number };
}

const sube = useSubeStore();
const adisyonlar = ref<AdisyonOzet[]>([]);
const yukleniyor = ref(false);
const hata = ref('');
const aktifDurum = ref<'AKTIF' | 'KAPALI' | 'IPTAL'>('AKTIF');

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  hata.value = '';
  try {
    const params = new URLSearchParams({ subeId: sube.aktifSubeId });
    if (aktifDurum.value === 'KAPALI') params.set('durum', 'KAPALI');
    else if (aktifDurum.value === 'IPTAL') params.set('durum', 'IPTAL');
    adisyonlar.value = await apiFetch<AdisyonOzet[]>(`/adisyonlar?${params}`);
  } catch (e: any) {
    hata.value = e?.data?.message || 'Liste alınamadı';
  } finally {
    yukleniyor.value = false;
  }
}

const { on } = useSocket();

watch([() => sube.aktifSubeId, aktifDurum], () => listele(), { immediate: true });
onMounted(() => {
  listele();
  const off1 = on('siparis:yeni', () => listele());
  const off2 = on('adisyon:guncel', () => listele());
  const off3 = on('odeme:yeni', () => listele());
  onUnmounted(() => {
    off1?.();
    off2?.();
    off3?.();
  });
});

const durumStil: Record<string, { bg: string; text: string; label: string }> = {
  ACIK: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-300', label: 'Açık' },
  ODEME_BEKLIYOR: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-300', label: 'Ödeme Bekliyor' },
  KAPALI: { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-pearl-60', label: 'Kapalı' },
  IPTAL: { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-300', label: 'İptal' },
};

async function yeniAdisyon() {
  if (!sube.aktifSubeId) return;
  try {
    const a = await apiFetch<{ id: string }>('/adisyonlar', {
      method: 'POST',
      body: { subeId: sube.aktifSubeId },
    });
    await navigateTo(`/adisyon/${a.id}`);
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Adisyon açılamadı');
  }
}
</script>

<template>
  <PageHeader baslik="Adisyonlar" aciklama="Aktif ve geçmiş adisyonlar" ikon="fa-receipt">
    <template #actions>
      <button @click="yeniAdisyon" :disabled="!sube.aktifSubeId" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-plus mr-2" /> Yeni Adisyon (Masasız)
      </button>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">
    Önce bir şube seç
  </div>

  <template v-else>
    <div class="flex gap-2 mb-6">
      <button
        @click="aktifDurum = 'AKTIF'"
        :class="['px-4 py-2 rounded-xl text-sm transition border', aktifDurum === 'AKTIF' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'border-glass-border text-pearl-60 hover:text-pearl']"
      >
        <i class="fas fa-circle-check mr-1.5" /> Aktif
      </button>
      <button
        @click="aktifDurum = 'KAPALI'"
        :class="['px-4 py-2 rounded-xl text-sm transition border', aktifDurum === 'KAPALI' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60 hover:text-pearl']"
      >
        <i class="fas fa-check mr-1.5" /> Kapalı (Bugün)
      </button>
      <button
        @click="aktifDurum = 'IPTAL'"
        :class="['px-4 py-2 rounded-xl text-sm transition border', aktifDurum === 'IPTAL' ? 'bg-red-500/15 border-red-500/40 text-red-300' : 'border-glass-border text-pearl-60 hover:text-pearl']"
      >
        <i class="fas fa-times mr-1.5" /> İptal
      </button>
    </div>

    <div v-if="yukleniyor && !adisyonlar.length" class="text-center py-12 text-pearl-60">
      <i class="fas fa-spinner fa-spin text-2xl" />
    </div>

    <div v-else-if="hata" class="glass-card p-6 border-red-500/30 text-red-300">
      <i class="fas fa-exclamation-triangle mr-2" />{{ hata }}
    </div>

    <EmptyState
      v-else-if="!adisyonlar.length"
      ikon="fa-receipt"
      :baslik="aktifDurum === 'AKTIF' ? 'Aktif adisyon yok' : 'Kayıt yok'"
      aciklama="Masaya tıklayarak veya yeni adisyon açarak başla"
    />

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <NuxtLink
        v-for="a in adisyonlar"
        :key="a.id"
        :to="`/adisyon/${a.id}`"
        :class="['glass-card p-5 hover:scale-[1.02] hover:border-gold-primary/40 transition border-2', durumStil[a.durum]?.bg]"
      >
        <div class="flex items-start justify-between mb-4">
          <div>
            <div class="text-xs text-pearl-50 mb-1">{{ a.numara }}</div>
            <div class="text-2xl font-bold gold-text">
              <i class="fas fa-table mr-2 text-gold-primary/60 text-base" v-if="a.masa" />
              {{ a.masa?.ad || 'Masasız' }}
            </div>
          </div>
          <span :class="['text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full', durumStil[a.durum]?.text]">
            {{ durumStil[a.durum]?.label }}
          </span>
        </div>

        <div class="space-y-1.5 text-sm">
          <div class="flex items-center justify-between">
            <span class="text-pearl-50"><i class="fas fa-utensils w-4 mr-1.5" />Sipariş</span>
            <span class="text-pearl-70">{{ a._count?.siparisler ?? 0 }}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-pearl-50"><i class="fas fa-clock w-4 mr-1.5" />Açılış</span>
            <span class="text-pearl-70">{{ saatFormat(a.acilis) }} ({{ gecenSure(a.acilis) }})</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-pearl-50"><i class="fas fa-user w-4 mr-1.5" />Açan</span>
            <span class="text-pearl-70 truncate">{{ a.acanKullanici.adSoyad }}</span>
          </div>
        </div>

        <div class="mt-4 pt-4 border-t border-glass-border flex items-end justify-between">
          <span class="text-xs text-pearl-50 uppercase tracking-wider">Toplam</span>
          <span class="text-2xl font-bold gold-text">{{ paraFormat(a.toplamTutar) }}</span>
        </div>
      </NuxtLink>
    </div>
  </template>
</template>
