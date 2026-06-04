<script setup lang="ts">
import { paraFormat, saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface Kat {
  id: string;
  ad: string;
  sira: number;
  _count?: { masalar: number };
}

interface Masa {
  id: string;
  subeId: string;
  katId?: string | null;
  ad: string;
  kapasite: number;
  durum: 'BOS' | 'DOLU' | 'REZERVE' | 'ODEME_BEKLIYOR';
  kat?: { id: string; ad: string } | null;
}

interface AktifAdisyon {
  id: string;
  numara: string;
  toplamTutar: string | number;
  acilis: string;
  masaId?: string | null;
  masa?: { id: string; ad: string } | null;
  durum: string;
  acanKullanici?: { adSoyad: string };
}

const sube = useSubeStore();
const toast = useToastStore();

const katlar = ref<Kat[]>([]);
const masalar = ref<Masa[]>([]);
const adisyonlar = ref<AktifAdisyon[]>([]);
const aktifKatId = ref<string>('');
const yukleniyor = ref(false);

const { on } = useSocket();

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const [k, m, a] = await Promise.all([
      apiFetch<Kat[]>(`/katlar?subeId=${sube.aktifSubeId}`),
      apiFetch<Masa[]>(`/masalar?subeId=${sube.aktifSubeId}`),
      apiFetch<AktifAdisyon[]>(`/adisyonlar?subeId=${sube.aktifSubeId}`),
    ]);
    katlar.value = k;
    masalar.value = m;
    adisyonlar.value = a;
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => listele(), { immediate: true });

onMounted(() => {
  listele();
  const off1 = on('masa:guncel', () => listele());
  const off2 = on('adisyon:guncel', () => listele());
  const off3 = on('odeme:yeni', () => listele());
  onUnmounted(() => { off1?.(); off2?.(); off3?.(); });
});

const filtreliMasalar = computed(() => {
  if (!aktifKatId.value) return masalar.value;
  if (aktifKatId.value === 'DOLU') {
    return masalar.value.filter((m) => m.durum === 'DOLU' || m.durum === 'ODEME_BEKLIYOR');
  }
  return masalar.value.filter((m) => m.katId === aktifKatId.value);
});

const aktifAdisyonlar = computed(() =>
  adisyonlar.value
    .filter((a) => a.durum === 'ACIK' || a.durum === 'ODEME_BEKLIYOR')
    .sort((a, b) => new Date(b.acilis).getTime() - new Date(a.acilis).getTime()),
);

const toplamCiro = computed(() =>
  aktifAdisyonlar.value.reduce((s, a) => s + Number(a.toplamTutar), 0),
);

const adisyonByMasa = computed(() => {
  const m: Record<string, AktifAdisyon> = {};
  for (const a of aktifAdisyonlar.value) {
    if (a.masaId) m[a.masaId] = a;
  }
  return m;
});

const sayilar = computed(() => {
  const m: Record<string, number> = { '': masalar.value.length, DOLU: 0 };
  for (const k of katlar.value) m[k.id] = 0;
  for (const ms of masalar.value) {
    if (ms.katId && m[ms.katId] !== undefined) m[ms.katId]++;
    if (ms.durum === 'DOLU' || ms.durum === 'ODEME_BEKLIYOR') m.DOLU++;
  }
  return m;
});

function kartSinifi(m: Masa) {
  if (m.durum === 'ODEME_BEKLIYOR') return 'table-card payment';
  if (m.durum === 'DOLU') return 'table-card occupied';
  if (m.durum === 'REZERVE') return 'table-card reserved';
  return 'table-card empty';
}

async function masaAc(m: Masa) {
  try {
    const mevcut = adisyonByMasa.value[m.id];
    if (mevcut) return navigateTo(`/adisyon/${mevcut.id}`);
    const yeni = await apiFetch<{ id: string }>('/adisyonlar', {
      method: 'POST',
      body: { subeId: m.subeId, masaId: m.id },
    });
    return navigateTo(`/adisyon/${yeni.id}`);
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Adisyon açılamadı');
  }
}

const masaModalAcik = ref(false);
const duzenlenenMasa = ref<Masa | null>(null);
const masaForm = reactive({ ad: '', kapasite: 4, katId: '' });

function masaYeniAc() {
  duzenlenenMasa.value = null;
  Object.assign(masaForm, {
    ad: '',
    kapasite: 4,
    katId: aktifKatId.value && aktifKatId.value !== 'DOLU' ? aktifKatId.value : '',
  });
  masaModalAcik.value = true;
}

function masaDuzenleAc(m: Masa) {
  duzenlenenMasa.value = m;
  Object.assign(masaForm, { ad: m.ad, kapasite: m.kapasite, katId: m.katId || '' });
  masaModalAcik.value = true;
}

const masaKaydediliyor = ref(false);

async function masaKaydet() {
  if (!sube.aktifSubeId) return;
  masaKaydediliyor.value = true;
  try {
    const payload: any = {
      ad: masaForm.ad.trim(),
      kapasite: Number(masaForm.kapasite),
      katId: masaForm.katId || undefined,
    };
    if (duzenlenenMasa.value) {
      await apiFetch(`/masalar/${duzenlenenMasa.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/masalar', { method: 'POST', body: { ...payload, subeId: sube.aktifSubeId } });
    }
    masaModalAcik.value = false;
    await listele();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Kaydedilemedi');
  } finally {
    masaKaydediliyor.value = false;
  }
}

const { onay } = useOnay();

async function masaSil(m: Masa) {
  if (!(await onay({
    baslik: 'Masayı sil',
    mesaj: `${m.ad} masası silinecek. Açık adisyonu varsa silinmez.`,
    onayMetni: 'Sil',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/masalar/${m.id}`, { method: 'DELETE' });
    await listele();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Silinemedi');
  }
}

const katModalAcik = ref(false);
const duzenlenenKat = ref<Kat | null>(null);
const katForm = reactive({ ad: '', sira: 0 });

function katYeniAc() {
  duzenlenenKat.value = null;
  Object.assign(katForm, { ad: '', sira: katlar.value.length });
  katModalAcik.value = true;
}

const katKaydediliyor = ref(false);

async function katKaydet() {
  if (!sube.aktifSubeId) return;
  katKaydediliyor.value = true;
  try {
    const payload: any = { ad: katForm.ad.trim(), sira: Number(katForm.sira) };
    if (duzenlenenKat.value) {
      await apiFetch(`/katlar/${duzenlenenKat.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/katlar', { method: 'POST', body: { ...payload, subeId: sube.aktifSubeId } });
    }
    katModalAcik.value = false;
    await listele();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Kaydedilemedi');
  } finally {
    katKaydediliyor.value = false;
  }
}
</script>

<template>
  <!-- Sayfaya özel layout — kenar boşluklarını sıfırlayıp paneli aç -->
  <div class="-mx-4 sm:-mx-5 lg:-mx-6 -my-4 sm:-my-5 lg:-my-6 flex min-h-[calc(100vh-65px)]">
    <!-- SOL: Aksiyon paneli -->
    <AppActionBar
      :ogeler="[
        { ad: 'Yeni Masa', ikon: 'fa-plus', vurgu: true, onClick: masaYeniAc },
        { ad: 'Yeni Kat', ikon: 'fa-layer-group', onClick: katYeniAc },
        { ad: 'Yenile', ikon: 'fa-rotate', onClick: listele },
      ]"
    />

    <!-- SOL ORTA: Aktif Adisyonlar (desktop) -->
    <section
      v-if="aktifAdisyonlar.length"
      class="hidden xl:flex flex-col w-80 bg-white border-r border-pearl-10"
    >
      <div class="p-5 border-b border-pearl-10">
        <div class="flex items-center gap-3">
          <span class="w-10 h-10 rounded-xl bg-gold-soft border border-gold-primary/30 text-gold-primary flex items-center justify-center font-bold tabular">
            {{ aktifAdisyonlar.length }}
          </span>
          <h2 class="text-base font-medium text-pearl tracking-wide">AKTİF ADİSYON</h2>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-3 space-y-1.5">
        <NuxtLink
          v-for="(a, i) in aktifAdisyonlar"
          :key="a.id"
          :to="`/adisyon/${a.id}`"
          class="flex items-center gap-3 p-3 rounded-xl hover:bg-pearl-5 transition"
        >
          <span
            class="w-8 h-8 rounded-lg bg-gold-soft border border-gold-primary/20 text-gold-primary text-sm font-bold flex items-center justify-center shrink-0 tabular"
          >{{ aktifAdisyonlar.length - i }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-sm font-medium text-pearl truncate">
              {{ a.masa?.ad || 'Masasız' }}
            </div>
            <div class="text-[10px] text-pearl-50">{{ saatFormat(a.acilis) }}</div>
          </div>
          <div class="font-medium gold-text tabular shrink-0">{{ paraFormat(a.toplamTutar) }}</div>
        </NuxtLink>
      </div>
      <div class="p-5 border-t border-pearl-10 bg-ink-200">
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">Toplam Açık</div>
        <div class="text-2xl font-light gold-text tabular">{{ paraFormat(toplamCiro) }}</div>
      </div>
    </section>

    <!-- ORTA: Masa Grid -->
    <main class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 min-w-0">
      <div class="flex items-start sm:items-center justify-between gap-3 mb-4 sm:mb-6 flex-wrap">
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1 truncate">
            <i class="fas fa-store text-gold-primary mr-1.5 text-[9px]" />
            {{ sube.aktifSube?.ad || '—' }}
          </div>
          <h1 class="text-2xl sm:text-3xl font-light text-pearl tracking-tight">
            Masalar
            <span class="text-pearl-40 text-base sm:text-lg ml-1 sm:ml-2 font-extralight tabular">{{ filtreliMasalar.length }}</span>
          </h1>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span class="text-[11px] sm:text-xs text-emerald-300 font-medium tabular">{{ masalar.filter(m => m.durum === 'BOS').length }} Boş</span>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold-soft border border-gold-primary/20">
            <span class="w-1.5 h-1.5 rounded-full bg-gold-primary" />
            <span class="text-[11px] sm:text-xs text-gold-primary font-medium tabular">{{ sayilar.DOLU }} Dolu</span>
          </div>
        </div>
      </div>

      <!-- Mobil/tablet kat filtre (yatay scroll) -->
      <div class="xl:hidden mb-4 -mx-4 sm:-mx-6 md:-mx-8 px-4 sm:px-6 md:px-8 overflow-x-auto flex gap-2 pb-1 scrollbar-thin">
        <button
          @click="aktifKatId = ''"
          :class="[
            'shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium border transition whitespace-nowrap',
            aktifKatId === ''
              ? 'bg-gold-soft border-gold-primary/40 text-gold-primary'
              : 'border-pearl-10 text-pearl-60 hover:text-pearl hover:border-pearl-30'
          ]"
        >
          Tümü <span class="tabular text-pearl-40 ml-1">{{ masalar.length }}</span>
        </button>
        <button
          @click="aktifKatId = 'DOLU'"
          :class="[
            'shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium border transition whitespace-nowrap flex items-center gap-1.5',
            aktifKatId === 'DOLU'
              ? 'bg-gold-soft border-gold-primary/40 text-gold-primary'
              : 'border-pearl-10 text-pearl-60 hover:text-pearl hover:border-pearl-30'
          ]"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-gold-primary" />Dolu <span class="tabular text-pearl-40">{{ sayilar.DOLU }}</span>
        </button>
        <button
          v-for="k in katlar"
          :key="k.id"
          @click="aktifKatId = k.id"
          :class="[
            'shrink-0 px-3.5 py-2 rounded-lg text-xs font-medium border transition whitespace-nowrap',
            aktifKatId === k.id
              ? 'bg-gold-soft border-gold-primary/40 text-gold-primary'
              : 'border-pearl-10 text-pearl-60 hover:text-pearl hover:border-pearl-30'
          ]"
        >
          {{ k.ad }} <span class="tabular text-pearl-40 ml-1">{{ sayilar[k.id] || 0 }}</span>
        </button>
      </div>

      <div v-if="!sube.aktifSubeId" class="glass-card p-12 text-center text-pearl-50">
        Önce bir şube seç
      </div>

      <div v-else-if="yukleniyor && !masalar.length" class="text-center py-16 text-pearl-50">
        <i class="fas fa-spinner fa-spin text-3xl" />
      </div>

      <EmptyState
        v-else-if="!filtreliMasalar.length"
        ikon="fa-table"
        :baslik="masalar.length ? 'Bu kategoride masa yok' : 'Henüz masa yok'"
        :aciklama="!masalar.length ? 'Sol aksiyon panelinden yeni masa ekle' : ''"
      />

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-2 sm:gap-3">
        <article
          v-for="m in filtreliMasalar"
          :key="m.id"
          :class="[kartSinifi(m), 'group']"
          @click="masaAc(m)"
        >
          <div class="flex items-start justify-between mb-auto">
            <div>
              <span v-if="m.durum === 'DOLU'" class="badge-gold !text-[9px]">Dolu</span>
              <span v-else-if="m.durum === 'ODEME_BEKLIYOR'" class="badge-info !text-[9px]">Ödeme</span>
              <span v-else-if="m.durum === 'REZERVE'" class="badge-warning !text-[9px]">Rezerve</span>
              <span v-else class="badge-success !text-[9px]">Boş</span>
            </div>
            <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition" @click.stop>
              <button @click="masaDuzenleAc(m)" class="text-pearl-50 hover:text-gold-primary p-1 rounded hover:bg-pearl-10">
                <i class="fas fa-pen-to-square text-xs" />
              </button>
              <button @click="masaSil(m)" class="text-pearl-50 hover:text-red-300 p-1 rounded hover:bg-red-500/10">
                <i class="fas fa-trash text-xs" />
              </button>
            </div>
          </div>

          <div class="text-center my-auto">
            <div
              v-if="m.durum === 'BOS'"
              class="text-3xl font-light tracking-tight leading-none mb-1 text-pearl"
            >{{ m.ad }}</div>
            <div
              v-else-if="m.durum === 'DOLU'"
              class="text-3xl font-light tracking-tight leading-none mb-1 gold-text"
            >{{ m.ad }}</div>
            <div
              v-else-if="m.durum === 'ODEME_BEKLIYOR'"
              class="text-3xl font-light tracking-tight leading-none mb-1 text-blue-300"
            >{{ m.ad }}</div>
            <div
              v-else
              class="text-3xl font-light tracking-tight leading-none mb-1 text-amber-300"
            >{{ m.ad }}</div>

            <div
              v-if="adisyonByMasa[m.id]"
              :class="[
                'text-base font-medium tabular mt-2',
                m.durum === 'ODEME_BEKLIYOR' ? 'text-blue-300' : 'text-gold-bright',
              ]"
            >
              {{ paraFormat(adisyonByMasa[m.id].toplamTutar) }}
            </div>
          </div>

          <div class="flex items-center justify-between text-[10px] mt-auto pt-2 border-t border-pearl-10">
            <span class="text-pearl-50 uppercase tracking-wider">
              <i class="fas fa-users mr-0.5" />{{ m.kapasite }}
            </span>
            <span v-if="adisyonByMasa[m.id]" class="text-pearl-60 tabular">
              {{ saatFormat(adisyonByMasa[m.id].acilis) }}
            </span>
            <span v-else-if="m.kat" class="text-pearl-50 uppercase tracking-wider truncate">
              {{ m.kat.ad }}
            </span>
          </div>
        </article>
      </div>
    </main>

    <!-- SAĞ: Kat Tab'ları (xl ve üzeri) -->
    <nav class="hidden xl:flex flex-col w-44 bg-ink-200 border-l border-pearl-10 py-4 overflow-y-auto">
      <div class="px-4 mb-3">
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-40 font-semibold">Görünüm</div>
      </div>
      <button
        @click="aktifKatId = ''"
        :class="[
          'w-full text-left px-5 py-3.5 transition flex items-center justify-between text-sm font-medium',
          aktifKatId === ''
            ? 'bg-white text-gold-primary border-l-2 border-gold-primary'
            : 'text-pearl-60 hover:text-pearl hover:bg-pearl-5',
        ]"
      >
        <span>Tümü</span>
        <span class="text-[10px] tabular text-pearl-40">{{ masalar.length }}</span>
      </button>
      <button
        @click="aktifKatId = 'DOLU'"
        :class="[
          'w-full text-left px-5 py-3.5 transition flex items-center justify-between text-sm font-medium',
          aktifKatId === 'DOLU'
            ? 'bg-white text-gold-primary border-l-2 border-gold-primary'
            : 'text-pearl-60 hover:text-pearl hover:bg-pearl-5',
        ]"
      >
        <span class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-gold-primary" />
          Dolu
        </span>
        <span class="text-[10px] tabular text-pearl-40">{{ sayilar.DOLU }}</span>
      </button>

      <div class="px-4 mt-5 mb-3">
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-40 font-semibold">Katlar</div>
      </div>
      <button
        v-for="k in katlar"
        :key="k.id"
        @click="aktifKatId = k.id"
        :class="[
          'w-full text-left px-5 py-3.5 transition flex items-center justify-between text-sm font-medium',
          aktifKatId === k.id
            ? 'bg-white text-gold-primary border-l-2 border-gold-primary'
            : 'text-pearl-60 hover:text-pearl hover:bg-pearl-5',
        ]"
      >
        <span>{{ k.ad }}</span>
        <span class="text-[10px] tabular text-pearl-40">{{ sayilar[k.id] || 0 }}</span>
      </button>

      <div v-if="!katlar.length" class="px-5 py-3 text-xs text-pearl-50">Henüz kat yok</div>
    </nav>
  </div>

  <AppModal
    :acik="masaModalAcik"
    :baslik="duzenlenenMasa ? 'Masayı Düzenle' : 'Yeni Masa'"
    genislik="max-w-md"
    @kapat="masaModalAcik = false"
  >
    <form @submit.prevent="masaKaydet" class="space-y-4">
      <div>
        <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">Masa Adı *</label>
        <input v-model="masaForm.ad" required class="input-base" placeholder="Örn: M1, Salon-3" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">Kapasite</label>
          <input v-model.number="masaForm.kapasite" type="number" min="1" class="input-base" />
        </div>
        <div>
          <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">Kat</label>
          <select v-model="masaForm.katId" class="input-base">
            <option value="">— Katsız —</option>
            <option v-for="k in katlar" :key="k.id" :value="k.id">{{ k.ad }}</option>
          </select>
        </div>
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" @click="masaModalAcik = false" class="btn-ghost">İptal</button>
        <button type="submit" :disabled="masaKaydediliyor" class="btn-gold">
          <i v-if="masaKaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          Kaydet
        </button>
      </div>
    </form>
  </AppModal>

  <AppModal
    :acik="katModalAcik"
    :baslik="duzenlenenKat ? 'Katı Düzenle' : 'Yeni Kat'"
    genislik="max-w-md"
    @kapat="katModalAcik = false"
  >
    <form @submit.prevent="katKaydet" class="space-y-4">
      <div>
        <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">Kat Adı *</label>
        <input v-model="katForm.ad" required class="input-base" placeholder="Örn: Salon, Teras, Bahçe" />
      </div>
      <div>
        <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">Sıra</label>
        <input v-model.number="katForm.sira" type="number" min="0" class="input-base" />
      </div>
      <div class="flex gap-3 pt-2">
        <button type="button" @click="katModalAcik = false" class="btn-ghost">İptal</button>
        <button type="submit" :disabled="katKaydediliyor" class="btn-gold">
          <i v-if="katKaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          Kaydet
        </button>
      </div>
    </form>
  </AppModal>
</template>
