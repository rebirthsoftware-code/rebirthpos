<script setup lang="ts">
definePageMeta({ middleware: ['auth'] });

interface SubeOzet { id: string; ad: string }
interface Kullanici {
  id: string;
  eposta: string;
  adSoyad: string;
  telefon?: string | null;
  rol: string;
  aktif: boolean;
  sonGiris?: string | null;
  subeler: { sube: SubeOzet }[];
}

const auth = useAuthStore();
const sube = useSubeStore();
const kullanicilar = ref<Kullanici[]>([]);
const yukleniyor = ref(false);
const hata = ref('');
const arama = ref('');
const rolFiltre = ref<string>('');

const modalAcik = ref(false);
const duzenlenen = ref<Kullanici | null>(null);
const form = reactive({
  eposta: '',
  sifre: '',
  yeniSifre: '',
  adSoyad: '',
  telefon: '',
  rol: 'KASIYER',
  aktif: true,
  subeIds: [] as string[],
});

const roller = [
  { kod: 'SUPER_ADMIN', ad: 'Süper Admin', ikon: 'fa-crown', renk: 'amber' },
  { kod: 'FIRMA_ADMIN', ad: 'Firma Yöneticisi', ikon: 'fa-building', renk: 'purple' },
  { kod: 'SUBE_MUDURU', ad: 'Şube Müdürü', ikon: 'fa-user-tie', renk: 'blue' },
  { kod: 'KASIYER', ad: 'Kasiyer', ikon: 'fa-cash-register', renk: 'emerald' },
  { kod: 'GARSON', ad: 'Garson', ikon: 'fa-concierge-bell', renk: 'cyan' },
  { kod: 'MUTFAK', ad: 'Mutfak', ikon: 'fa-fire', renk: 'red' },
  { kod: 'KURYE', ad: 'Kurye', ikon: 'fa-motorcycle', renk: 'orange' },
];

const rolBilgi = (k: string) => roller.find((r) => r.kod === k);

async function listele() {
  yukleniyor.value = true;
  hata.value = '';
  try {
    kullanicilar.value = await apiFetch<Kullanici[]>('/kullanicilar');
  } catch (e: any) {
    hata.value = e?.data?.message || 'Yüklenemedi';
  } finally {
    yukleniyor.value = false;
  }
}

onMounted(() => listele());

const filtreli = computed(() => {
  let liste = kullanicilar.value;
  if (rolFiltre.value) liste = liste.filter((k) => k.rol === rolFiltre.value);
  if (arama.value.trim()) {
    const q = arama.value.toLocaleLowerCase('tr');
    liste = liste.filter(
      (k) =>
        k.adSoyad.toLocaleLowerCase('tr').includes(q) ||
        k.eposta.toLocaleLowerCase('tr').includes(q),
    );
  }
  return liste;
});

function yeniAc() {
  duzenlenen.value = null;
  Object.assign(form, {
    eposta: '',
    sifre: '',
    yeniSifre: '',
    adSoyad: '',
    telefon: '',
    rol: 'KASIYER',
    aktif: true,
    subeIds: sube.aktifSubeId ? [sube.aktifSubeId] : [],
  });
  modalAcik.value = true;
}

function duzenleAc(k: Kullanici) {
  duzenlenen.value = k;
  Object.assign(form, {
    eposta: k.eposta,
    sifre: '',
    yeniSifre: '',
    adSoyad: k.adSoyad,
    telefon: k.telefon || '',
    rol: k.rol,
    aktif: k.aktif,
    subeIds: k.subeler.map((s) => s.sube.id),
  });
  modalAcik.value = true;
}

const kaydediliyor = ref(false);

async function kaydet() {
  kaydediliyor.value = true;
  try {
    if (duzenlenen.value) {
      const payload: any = {
        adSoyad: form.adSoyad.trim(),
        telefon: form.telefon.trim() || undefined,
        rol: form.rol,
        aktif: form.aktif,
        subeIds: form.subeIds,
      };
      if (form.yeniSifre) payload.yeniSifre = form.yeniSifre;
      await apiFetch(`/kullanicilar/${duzenlenen.value.id}`, { method: 'PATCH', body: payload });
    } else {
      await apiFetch('/kullanicilar', {
        method: 'POST',
        body: {
          eposta: form.eposta.trim(),
          sifre: form.sifre,
          adSoyad: form.adSoyad.trim(),
          telefon: form.telefon.trim() || undefined,
          rol: form.rol,
          subeIds: form.subeIds,
        },
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

async function sil(k: Kullanici) {
  if (!(await onay({
    baslik: 'Personeli pasifleştir',
    mesaj: `${k.adSoyad} pasifleştirilecek. Hesap silinmez, geçmiş veriler korunur.`,
    onayMetni: 'Pasifleştir',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/kullanicilar/${k.id}`, { method: 'DELETE' });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Hata');
  }
}
</script>

<template>
  <PageHeader baslik="Personel" aciklama="Çalışanları yönet, şube ata, yetki ver" ikon="fa-users">
    <template #actions>
      <button @click="yeniAc" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-user-plus mr-2" /> Yeni Personel
      </button>
    </template>
  </PageHeader>

  <div class="flex flex-col md:flex-row gap-3 mb-6">
    <div class="relative flex-1">
      <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-pearl-50" />
      <input v-model="arama" class="input-base pl-11" placeholder="Personel ara..." />
    </div>
    <select v-model="rolFiltre" class="input-base md:max-w-xs">
      <option value="">Tüm Roller</option>
      <option v-for="r in roller" :key="r.kod" :value="r.kod">{{ r.ad }}</option>
    </select>
  </div>

  <div v-if="yukleniyor" class="text-center py-12 text-pearl-60">
    <i class="fas fa-spinner fa-spin text-2xl" />
  </div>

  <div v-else-if="hata" class="glass-card p-6 border-red-500/30 text-red-300">
    <i class="fas fa-exclamation-triangle mr-2" />{{ hata }}
  </div>

  <EmptyState v-else-if="!filtreli.length" ikon="fa-users" baslik="Personel bulunamadı" />

  <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div
      v-for="k in filtreli"
      :key="k.id"
      class="glass-card p-5 hover:border-gold-primary/40 transition group"
      :class="{ 'opacity-60': !k.aktif }"
    >
      <div class="flex items-start gap-3 mb-3">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0"
          :class="`bg-${rolBilgi(k.rol)?.renk}-500/15 text-${rolBilgi(k.rol)?.renk}-300`"
        >
          <i :class="['fas', rolBilgi(k.rol)?.ikon || 'fa-user']" />
        </div>
        <div class="flex-1 min-w-0">
          <h3 class="font-semibold truncate">{{ k.adSoyad }}</h3>
          <div class="text-xs text-gold-primary">{{ rolBilgi(k.rol)?.ad || k.rol }}</div>
        </div>
        <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition">
          <button @click="duzenleAc(k)" class="text-pearl-60 hover:text-gold-primary p-1.5 rounded-lg hover:bg-pearl-5">
            <i class="fas fa-pen-to-square text-sm" />
          </button>
          <button @click="sil(k)" class="text-pearl-60 hover:text-red-300 p-1.5 rounded-lg hover:bg-red-500/10">
            <i class="fas fa-user-slash text-sm" />
          </button>
        </div>
      </div>

      <div class="space-y-1 text-xs text-pearl-60 mb-3">
        <div><i class="fas fa-envelope w-4 text-gold-primary/60" /> {{ k.eposta }}</div>
        <div v-if="k.telefon"><i class="fas fa-phone w-4 text-gold-primary/60" /> {{ k.telefon }}</div>
      </div>

      <div v-if="k.subeler.length" class="flex flex-wrap gap-1 mb-2">
        <span
          v-for="s in k.subeler"
          :key="s.sube.id"
          class="text-[10px] uppercase tracking-wider bg-gold-primary/10 text-gold-primary px-2 py-0.5 rounded-full"
        >
          <i class="fas fa-store mr-1" />{{ s.sube.ad }}
        </span>
      </div>

      <div v-if="!k.aktif" class="text-[10px] text-red-400 uppercase tracking-wider">Pasif</div>
    </div>
  </div>

  <AppModal
    :acik="modalAcik"
    :baslik="duzenlenen ? 'Personeli Düzenle' : 'Yeni Personel'"
    genislik="max-w-xl"
    @kapat="modalAcik = false"
  >
    <form @submit.prevent="kaydet" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="md:col-span-2">
          <label class="block text-sm text-pearl-60 mb-2">Ad Soyad *</label>
          <input v-model="form.adSoyad" required class="input-base" />
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">E-posta *</label>
          <input
            v-model="form.eposta"
            type="email"
            required
            :disabled="!!duzenlenen"
            class="input-base disabled:opacity-60"
          />
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">Telefon</label>
          <input v-model="form.telefon" class="input-base" />
        </div>

        <div v-if="!duzenlenen">
          <label class="block text-sm text-pearl-60 mb-2">Şifre *</label>
          <input v-model="form.sifre" type="password" required minlength="6" class="input-base" />
        </div>
        <div v-else>
          <label class="block text-sm text-pearl-60 mb-2">Yeni Şifre (boş = değiştirme)</label>
          <input v-model="form.yeniSifre" type="password" minlength="6" class="input-base" />
        </div>

        <div>
          <label class="block text-sm text-pearl-60 mb-2">Rol *</label>
          <select v-model="form.rol" required class="input-base">
            <option v-for="r in roller" :key="r.kod" :value="r.kod">{{ r.ad }}</option>
          </select>
        </div>
      </div>

      <div>
        <label class="block text-sm text-pearl-60 mb-2">Çalışacağı Şubeler</label>
        <div class="grid grid-cols-2 gap-2">
          <label
            v-for="s in sube.subeler"
            :key="s.id"
            class="input-base flex items-center gap-2 cursor-pointer hover:bg-pearl-5"
          >
            <input
              type="checkbox"
              :value="s.id"
              v-model="form.subeIds"
              class="accent-gold-primary w-4 h-4"
            />
            <span class="text-sm">{{ s.ad }}</span>
          </label>
        </div>
      </div>

      <label v-if="duzenlenen" class="input-base flex items-center gap-2 cursor-pointer">
        <input v-model="form.aktif" type="checkbox" class="accent-gold-primary w-4 h-4" />
        <span class="text-sm">Aktif</span>
      </label>

      <div class="flex gap-3 pt-2">
        <button type="button" @click="modalAcik = false" class="flex-1 glass-card py-3 text-sm hover:bg-glass-hover transition">İptal</button>
        <button type="submit" :disabled="kaydediliyor" class="btn-gold flex-1">
          <i v-if="kaydediliyor" class="fas fa-spinner fa-spin mr-2" />
          <i v-else class="fas fa-check mr-2" />
          {{ kaydediliyor ? 'Kaydediliyor...' : 'Kaydet' }}
        </button>
      </div>
    </form>
  </AppModal>
</template>
