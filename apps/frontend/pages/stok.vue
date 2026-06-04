<script setup lang="ts">
import { saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface UrunStok {
  id: string;
  ad: string;
  stok: string | number;
  stokBirim: string;
  stokUyariEsigi: string | number;
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
const sekme = ref<'durum' | 'hareket'>('durum');

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    if (sekme.value === 'durum') {
      urunler.value = await apiFetch<UrunStok[]>(`/stok/durum?subeId=${sube.aktifSubeId}`);
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
            <div v-if="u.kategori" class="text-xs text-pearl-50">{{ u.kategori.ad }}</div>
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
            @click="hareketAc(u)"
            class="glass-card py-2 px-3 text-xs hover:bg-glass-hover transition shrink-0"
          >
            <i class="fas fa-plus-minus mr-1" /> Hareket
          </button>
        </div>
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
</template>
