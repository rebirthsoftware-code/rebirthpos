<script setup lang="ts">
import { paraFormat, gecenSure, saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface Urun { id: string; ad: string; fiyat: string | number; resimUrl?: string | null; kategoriId?: string | null }
interface Kategori { id: string; ad: string; renk?: string | null }
interface Kurye { id: string; adSoyad: string; telefon?: string | null }
interface SiparisKalem { adet: number; toplam: string | number; urun: { ad: string } }
interface PaketAdisyon {
  id: string;
  numara: string;
  tip: 'PAKET' | 'GEL_AL';
  durum: string;
  paketDurum?: string | null;
  paketAdres?: string | null;
  toplamTutar: string | number;
  acilis: string;
  not?: string | null;
  musteri?: { id: string; adSoyad: string; telefon: string } | null;
  kurye?: { id: string; adSoyad: string; telefon?: string | null } | null;
  siparisler: { kalemler: SiparisKalem[] }[];
}

const sube = useSubeStore();
const auth = useAuthStore();
const paketler = ref<PaketAdisyon[]>([]);
const kuryeler = ref<Kurye[]>([]);
const yukleniyor = ref(false);
const aktifDurum = ref<string>('');

const { on } = useSocket();

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const params = new URLSearchParams({ subeId: sube.aktifSubeId });
    if (aktifDurum.value) params.set('durum', aktifDurum.value);
    paketler.value = await apiFetch<PaketAdisyon[]>(`/paket?${params}`);
    kuryeler.value = await apiFetch<Kurye[]>(`/kullanicilar/kuryeler?subeId=${sube.aktifSubeId}`);
  } finally {
    yukleniyor.value = false;
  }
}

watch([() => sube.aktifSubeId, aktifDurum], () => listele(), { immediate: true });
onMounted(() => {
  listele();
  const off1 = on('siparis:yeni', () => listele());
  const off2 = on('adisyon:guncel', () => listele());
  onUnmounted(() => { off1?.(); off2?.(); });
});

// Yeni paket modal
const yeniModalAcik = ref(false);
const urunler = ref<Urun[]>([]);
const kategoriler = ref<Kategori[]>([]);
const aktifKategori = ref('');
const arama = ref('');
const sepet = ref<Array<{ urun: Urun; adet: number }>>([]);
const form = reactive({
  musteriAdSoyad: '',
  musteriTelefon: '',
  adres: '',
  not: '',
  tip: 'PAKET' as 'PAKET' | 'GEL_AL',
});

async function urunleriYukle() {
  if (!sube.aktifSubeId) return;
  const [u, k] = await Promise.all([
    apiFetch<Urun[]>(`/urunler?subeId=${sube.aktifSubeId}`),
    apiFetch<Kategori[]>(`/kategoriler?subeId=${sube.aktifSubeId}`),
  ]);
  urunler.value = u;
  kategoriler.value = k;
}

async function yeniAc() {
  if (!urunler.value.length) await urunleriYukle();
  Object.assign(form, { musteriAdSoyad: '', musteriTelefon: '', adres: '', not: '', tip: 'PAKET' });
  sepet.value = [];
  yeniModalAcik.value = true;
}

const filtreliUrun = computed(() => {
  let l = urunler.value;
  if (aktifKategori.value) l = l.filter((u) => u.kategoriId === aktifKategori.value);
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    l = l.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q));
  }
  return l;
});

const sepetToplam = computed(() => sepet.value.reduce((s, x) => s + Number(x.urun.fiyat) * x.adet, 0));

function sepeteEkle(u: Urun) {
  const v = sepet.value.find((s) => s.urun.id === u.id);
  if (v) v.adet++;
  else sepet.value.push({ urun: u, adet: 1 });
}
function sepetAzalt(i: number) {
  if (sepet.value[i].adet > 1) sepet.value[i].adet--;
  else sepet.value.splice(i, 1);
}

// Müşteri telefonu sorgulama → otomatik doldurma
async function telefonAra() {
  if (!form.musteriTelefon || form.musteriTelefon.length < 7) return;
  try {
    const m = await apiFetch<any>(`/musteriler/telefon?subeId=${sube.aktifSubeId}&telefon=${form.musteriTelefon}`);
    if (m) {
      form.musteriAdSoyad = m.adSoyad;
      if (m.adres && !form.adres) form.adres = m.adres;
    }
  } catch {}
}

const kaydediliyor = ref(false);

async function paketKaydet() {
  if (!sepet.value.length || !sube.aktifSubeId) return;
  kaydediliyor.value = true;
  try {
    await apiFetch('/paket', {
      method: 'POST',
      body: {
        subeId: sube.aktifSubeId,
        musteriAdSoyad: form.musteriAdSoyad.trim(),
        musteriTelefon: form.musteriTelefon.trim(),
        adres: form.adres.trim() || undefined,
        not: form.not.trim() || undefined,
        tip: form.tip,
        kalemler: sepet.value.map((s) => ({ urunId: s.urun.id, adet: s.adet })),
      },
    });
    yeniModalAcik.value = false;
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  } finally {
    kaydediliyor.value = false;
  }
}

// Kurye ata
const kuryeModal = ref<PaketAdisyon | null>(null);
const secilenKurye = ref('');

async function kuryeAta() {
  if (!kuryeModal.value || !secilenKurye.value) return;
  try {
    await apiFetch(`/paket/${kuryeModal.value.id}/kurye`, {
      method: 'PATCH',
      body: { kuryeId: secilenKurye.value },
    });
    kuryeModal.value = null;
    secilenKurye.value = '';
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  }
}

async function durumGuncelle(p: PaketAdisyon, yeni: string) {
  try {
    await apiFetch(`/paket/${p.id}/durum`, { method: 'PATCH', body: { paketDurum: yeni } });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  }
}

const durumStil: Record<string, { bg: string; text: string; ad: string }> = {
  BEKLIYOR: { bg: 'bg-emerald-500/10 border-emerald-500/30', text: 'text-emerald-300', ad: 'Bekliyor' },
  HAZIRLANIYOR: { bg: 'bg-amber-500/10 border-amber-500/30', text: 'text-amber-300', ad: 'Hazırlanıyor' },
  YOLDA: { bg: 'bg-blue-500/10 border-blue-500/30', text: 'text-blue-300', ad: 'Yolda' },
  TESLIM_EDILDI: { bg: 'bg-gray-500/10 border-gray-500/30', text: 'text-pearl-60', ad: 'Teslim Edildi' },
};
</script>

<template>
  <PageHeader baslik="Paket Servis" aciklama="Paket ve gel-al siparişleri, kurye atama" ikon="fa-motorcycle">
    <template #actions>
      <button @click="yeniAc" :disabled="!sube.aktifSubeId" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-plus mr-2" /> Yeni Paket
      </button>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">Önce bir şube seç</div>

  <template v-else>
    <div class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="d in ['', 'BEKLIYOR', 'HAZIRLANIYOR', 'YOLDA', 'TESLIM_EDILDI']"
        :key="d"
        @click="aktifDurum = d"
        :class="['px-4 py-2 rounded-xl text-sm transition border', aktifDurum === d ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
      >
        {{ d === '' ? 'Aktifler' : durumStil[d]?.ad || d }}
      </button>
    </div>

    <div v-if="yukleniyor && !paketler.length" class="text-center py-12 text-pearl-60">
      <i class="fas fa-spinner fa-spin text-2xl" />
    </div>

    <EmptyState v-else-if="!paketler.length" ikon="fa-motorcycle" baslik="Paket sipariş yok" />

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <article
        v-for="p in paketler"
        :key="p.id"
        :class="['glass-card p-4 border-2', durumStil[p.paketDurum || 'BEKLIYOR']?.bg]"
      >
        <div class="flex items-start justify-between mb-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg font-bold gold-text">{{ p.musteri?.adSoyad || 'Müşteri' }}</span>
              <span
                v-if="p.tip === 'GEL_AL'"
                class="text-[10px] uppercase bg-purple-500/15 text-purple-300 px-2 py-0.5 rounded-full"
              >Gel-Al</span>
            </div>
            <div class="text-xs text-pearl-50">
              {{ p.numara }} · {{ saatFormat(p.acilis) }} ({{ gecenSure(p.acilis) }})
            </div>
          </div>
          <span :class="['text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full', durumStil[p.paketDurum || 'BEKLIYOR']?.text]">
            {{ durumStil[p.paketDurum || 'BEKLIYOR']?.ad }}
          </span>
        </div>

        <div class="space-y-1 text-xs text-pearl-60 mb-3">
          <div v-if="p.musteri?.telefon"><i class="fas fa-phone w-4 text-gold-primary/60" /> {{ p.musteri.telefon }}</div>
          <div v-if="p.paketAdres"><i class="fas fa-location-dot w-4 text-gold-primary/60" /> {{ p.paketAdres }}</div>
          <div v-if="p.not"><i class="fas fa-note-sticky w-4 text-gold-primary/60" /> {{ p.not }}</div>
        </div>

        <div class="space-y-1 mb-3 text-sm border-l-2 border-gold-primary/30 pl-3">
          <div
            v-for="(k, i) in p.siparisler.flatMap(s => s.kalemler)"
            :key="i"
            class="flex justify-between"
          >
            <span><span class="text-gold-primary font-bold">{{ k.adet }}×</span> {{ k.urun.ad }}</span>
            <span class="text-pearl-60">{{ paraFormat(k.toplam) }}</span>
          </div>
        </div>

        <div class="pt-3 border-t border-glass-border flex items-center justify-between mb-3">
          <span class="text-xs text-pearl-50">Toplam</span>
          <span class="font-bold gold-text">{{ paraFormat(p.toplamTutar) }}</span>
        </div>

        <div v-if="p.kurye" class="flex items-center gap-2 text-xs text-blue-300 mb-2 bg-blue-500/5 px-3 py-1.5 rounded-lg">
          <i class="fas fa-motorcycle" />
          <span class="font-medium">{{ p.kurye.adSoyad }}</span>
          <span v-if="p.kurye.telefon" class="text-blue-400">· {{ p.kurye.telefon }}</span>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            v-if="p.paketDurum === 'BEKLIYOR' || p.paketDurum === 'HAZIRLANIYOR'"
            @click="durumGuncelle(p, p.paketDurum === 'BEKLIYOR' ? 'HAZIRLANIYOR' : 'YOLDA')"
            class="flex-1 glass-card py-2 text-xs hover:bg-glass-hover transition"
          >
            <i class="fas fa-arrow-right mr-1" />
            {{ p.paketDurum === 'BEKLIYOR' ? 'Hazırla' : 'Hazır' }}
          </button>
          <button
            v-if="p.tip === 'PAKET' && !p.kurye"
            @click="kuryeModal = p"
            class="flex-1 glass-card py-2 text-xs hover:bg-glass-hover transition text-blue-300"
          >
            <i class="fas fa-motorcycle mr-1" /> Kurye Ata
          </button>
          <button
            v-if="p.paketDurum === 'YOLDA' || (p.tip === 'GEL_AL' && p.paketDurum !== 'TESLIM_EDILDI')"
            @click="durumGuncelle(p, 'TESLIM_EDILDI')"
            class="flex-1 glass-card py-2 text-xs hover:bg-glass-hover transition text-emerald-300"
          >
            <i class="fas fa-check mr-1" /> Teslim Edildi
          </button>
          <NuxtLink
            :to="`/adisyon/${p.id}`"
            class="glass-card py-2 px-3 text-xs hover:bg-glass-hover transition"
            title="Adisyonu aç (ödeme için)"
          >
            <i class="fas fa-receipt" />
          </NuxtLink>
        </div>
      </article>
    </div>
  </template>

  <!-- Yeni Paket Modal -->
  <AppModal :acik="yeniModalAcik" baslik="Yeni Paket Sipariş" genislik="max-w-4xl" @kapat="yeniModalAcik = false">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
      <!-- Sol: Müşteri + Ürünler -->
      <div class="space-y-4">
        <div class="flex gap-2">
          <button
            @click="form.tip = 'PAKET'"
            :class="['flex-1 px-4 py-2 rounded-xl text-sm transition border', form.tip === 'PAKET' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
          >
            <i class="fas fa-motorcycle mr-2" />Paket
          </button>
          <button
            @click="form.tip = 'GEL_AL'"
            :class="['flex-1 px-4 py-2 rounded-xl text-sm transition border', form.tip === 'GEL_AL' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
          >
            <i class="fas fa-bag-shopping mr-2" />Gel-Al
          </button>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-pearl-60 mb-1">Telefon *</label>
            <input
              v-model="form.musteriTelefon"
              @blur="telefonAra"
              required
              class="input-base"
              placeholder="05XX XXX XX XX"
            />
          </div>
          <div>
            <label class="block text-xs text-pearl-60 mb-1">Ad Soyad *</label>
            <input v-model="form.musteriAdSoyad" required class="input-base" />
          </div>
        </div>

        <div v-if="form.tip === 'PAKET'">
          <label class="block text-xs text-pearl-60 mb-1">Adres *</label>
          <textarea v-model="form.adres" rows="2" :required="form.tip === 'PAKET'" class="input-base resize-none" />
        </div>

        <div>
          <label class="block text-xs text-pearl-60 mb-1">Sipariş Notu</label>
          <textarea v-model="form.not" rows="2" class="input-base resize-none" />
        </div>

        <div class="relative">
          <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
          <input v-model="arama" class="input-base pl-11" placeholder="Ürün ara..." />
        </div>

        <div class="flex flex-wrap gap-1">
          <button
            @click="aktifKategori = ''"
            :class="['px-3 py-1 rounded-lg text-xs transition border', aktifKategori === '' ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
          >Tümü</button>
          <button
            v-for="k in kategoriler"
            :key="k.id"
            @click="aktifKategori = k.id"
            :class="['px-3 py-1 rounded-lg text-xs transition border', aktifKategori === k.id ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
          >{{ k.ad }}</button>
        </div>

        <div class="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
          <button
            v-for="u in filtreliUrun"
            :key="u.id"
            @click="sepeteEkle(u)"
            class="glass-card p-3 text-left hover:bg-glass-hover transition"
          >
            <div class="text-sm font-medium leading-tight line-clamp-2 mb-1">{{ u.ad }}</div>
            <div class="text-xs text-gold-primary font-bold">{{ paraFormat(u.fiyat) }}</div>
          </button>
        </div>
      </div>

      <!-- Sağ: Sepet -->
      <div class="space-y-3">
        <h4 class="font-semibold gold-text">
          <i class="fas fa-cart-shopping mr-2" />Sepet ({{ sepet.length }})
        </h4>

        <div v-if="!sepet.length" class="glass-card p-6 text-center text-pearl-50 text-sm">
          Sol taraftan ürün seç
        </div>

        <div v-else class="space-y-2 max-h-72 overflow-y-auto">
          <div v-for="(s, i) in sepet" :key="i" class="flex items-center gap-2 glass-card p-2.5">
            <div class="flex items-center bg-bg-dark/50 rounded-lg overflow-hidden">
              <button @click="sepetAzalt(i)" class="w-7 h-7 hover:bg-glass-hover text-gold-primary">−</button>
              <span class="w-7 text-center text-sm font-bold">{{ s.adet }}</span>
              <button @click="s.adet++" class="w-7 h-7 hover:bg-glass-hover text-gold-primary">+</button>
            </div>
            <div class="flex-1 text-sm truncate">{{ s.urun.ad }}</div>
            <div class="text-sm font-medium">{{ paraFormat(Number(s.urun.fiyat) * s.adet) }}</div>
          </div>
        </div>

        <div class="border-t border-glass-border pt-3 flex justify-between">
          <span class="text-sm text-pearl-60">Toplam</span>
          <span class="text-xl font-bold gold-text">{{ paraFormat(sepetToplam) }}</span>
        </div>

        <button
          @click="paketKaydet"
          :disabled="!sepet.length || kaydediliyor || !form.musteriAdSoyad || !form.musteriTelefon"
          class="btn-gold w-full"
        >
          <i v-if="kaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          Siparişi Oluştur
        </button>
      </div>
    </div>
  </AppModal>

  <!-- Kurye Atama Modal -->
  <AppModal :acik="!!kuryeModal" baslik="Kurye Ata" genislik="max-w-md" @kapat="kuryeModal = null">
    <div class="space-y-4">
      <div v-if="!kuryeler.length" class="glass-card p-6 text-center text-pearl-50 text-sm">
        Bu şubeye atanmış kurye yok. <NuxtLink to="/personel" class="text-gold-primary underline">Personel ekle</NuxtLink>
      </div>

      <button
        v-for="k in kuryeler"
        :key="k.id"
        @click="secilenKurye = k.id"
        :class="['w-full flex items-center gap-3 p-3 rounded-xl transition border', secilenKurye === k.id ? 'bg-gold-primary/15 border-gold-primary/40' : 'border-glass-border hover:bg-glass-hover']"
      >
        <div class="w-10 h-10 rounded-xl bg-blue-500/15 text-blue-300 flex items-center justify-center">
          <i class="fas fa-motorcycle" />
        </div>
        <div class="flex-1 text-left">
          <div class="font-medium">{{ k.adSoyad }}</div>
          <div v-if="k.telefon" class="text-xs text-pearl-50">{{ k.telefon }}</div>
        </div>
        <i v-if="secilenKurye === k.id" class="fas fa-check text-gold-primary" />
      </button>

      <div class="flex gap-3 pt-2">
        <button @click="kuryeModal = null" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">İptal</button>
        <button @click="kuryeAta" :disabled="!secilenKurye" class="btn-gold flex-1">
          <i class="fas fa-check mr-2" />Ata
        </button>
      </div>
    </div>
  </AppModal>
</template>
