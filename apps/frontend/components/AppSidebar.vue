<script setup lang="ts">
import type { Rol } from '~/stores/auth';

interface MenuItem {
  ad: string;
  yol: string;
  ikon: string;
  roller?: Rol[];
  rozet?: string;
}

interface MenuGrup {
  ad: string;
  ogeler: MenuItem[];
}

const auth = useAuthStore();
const route = useRoute();
const { acik, mobilAcik, mobilKapat } = useSidebar();

const gruplar: MenuGrup[] = [
  {
    ad: 'Genel',
    ogeler: [
      { ad: 'Dashboard', yol: '/', ikon: 'fa-gauge-high' },
    ],
  },
  {
    ad: 'Satış',
    ogeler: [
      { ad: 'Masalar', yol: '/masalar', ikon: 'fa-table' },
      { ad: 'Adisyonlar', yol: '/adisyonlar', ikon: 'fa-receipt' },
      { ad: 'e-Belgeler', yol: '/faturalar', ikon: 'fa-file-invoice' },
      { ad: 'Hızlı Sipariş', yol: '/hizli', ikon: 'fa-bolt' },
      { ad: 'Paket Servis', yol: '/paket', ikon: 'fa-motorcycle' },
      { ad: 'Mutfak', yol: '/mutfak', ikon: 'fa-fire', roller: ['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU', 'MUTFAK'] },
    ],
  },
  {
    ad: 'Katalog',
    ogeler: [
      { ad: 'Kategoriler', yol: '/kategoriler', ikon: 'fa-layer-group' },
      { ad: 'Ürünler', yol: '/urunler', ikon: 'fa-utensils' },
      { ad: 'Stok', yol: '/stok', ikon: 'fa-boxes-stacked' },
    ],
  },
  {
    ad: 'İlişkiler',
    ogeler: [
      { ad: 'Müşteriler', yol: '/musteriler', ikon: 'fa-address-book' },
      { ad: 'Personel', yol: '/personel', ikon: 'fa-user-tie', roller: ['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU'] },
    ],
  },
  {
    ad: 'Yönetim',
    ogeler: [
      { ad: 'Firmalar', yol: '/firmalar', ikon: 'fa-building', roller: ['SUPER_ADMIN'] },
      { ad: 'Şubeler', yol: '/subeler', ikon: 'fa-store', roller: ['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU'] },
      { ad: 'Raporlar', yol: '/raporlar', ikon: 'fa-chart-line', roller: ['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU'] },
      { ad: 'Cihaz Test', yol: '/cihaz-test', ikon: 'fa-microchip', roller: ['SUPER_ADMIN', 'FIRMA_ADMIN', 'SUBE_MUDURU'] },
    ],
  },
];

function musteriEkraniAc() {
  if (!import.meta.client) return;
  const yol = window.location.origin + '/musteri-ekran';
  window.open(
    yol,
    'rebirth-musteri-ekran',
    'width=1280,height=800,menubar=no,toolbar=no,location=no,status=no',
  );
  mobilKapat();
}

function gorunecekOgeler(g: MenuGrup) {
  return g.ogeler.filter((m) => !m.roller || (auth.rol && m.roller.includes(auth.rol)));
}

const gorunenGruplar = computed(() =>
  gruplar.map((g) => ({ ...g, ogeler: gorunecekOgeler(g) })).filter((g) => g.ogeler.length),
);

const rolEtiket: Record<string, string> = {
  SUPER_ADMIN: 'Süper Admin',
  FIRMA_ADMIN: 'Firma Yöneticisi',
  SUBE_MUDURU: 'Şube Müdürü',
  KASIYER: 'Kasiyer',
  GARSON: 'Garson',
  MUTFAK: 'Mutfak',
  KURYE: 'Kurye',
};

function cikis() {
  auth.cikis();
  mobilKapat();
  navigateTo('/login');
}

function aktif(m: MenuItem) {
  return route.path === m.yol || (m.yol !== '/' && route.path.startsWith(m.yol + '/'));
}

// Mobil drawer'da menüye tıklayınca otomatik kapansın
watch(() => route.path, () => {
  if (mobilAcik.value) mobilKapat();
});

// Mobil drawer açıkken arka plan scroll'u kilitle
watch(mobilAcik, (v) => {
  if (import.meta.client) {
    document.body.style.overflow = v ? 'hidden' : '';
  }
});

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = '';
});
</script>

<template>
  <!-- Mobil arka plan örtüsü -->
  <Transition
    enter-active-class="transition duration-200"
    leave-active-class="transition duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="mobilAcik"
      class="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
      @click="mobilKapat"
    />
  </Transition>

  <aside
    :class="[
      'fixed top-0 left-0 h-full flex flex-col bg-white border-r border-pearl-10 z-50 shadow-[2px_0_24px_-16px_rgba(28,28,32,0.10)]',
      'transition-transform duration-300 lg:transition-all',
      // Genişlik
      acik ? 'w-64' : 'lg:w-20 w-64',
      // Mobil görünürlük: drawer
      mobilAcik ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
    ]"
  >
    <!-- Sol altın aksent çubuk -->
    <div class="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold-primary/30 to-transparent" />

    <!-- Header -->
    <div class="px-5 py-5 flex items-center gap-3 border-b border-pearl-10">
      <div class="relative shrink-0">
        <div class="w-10 h-10 bg-gold-primary/10 rounded-xl flex items-center justify-center">
          <i class="fas fa-utensils text-gold-primary text-lg" />
        </div>
        <div class="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-gold-primary rounded-full" />
      </div>
      <div v-if="acik || mobilAcik" class="flex-1 min-w-0">
        <div class="font-light tracking-extra-wide text-pearl text-base">REBIRTH</div>
        <div class="text-[9px] text-pearl-50 uppercase tracking-extra-wide">POS · v0.8</div>
      </div>
      <!-- Desktop daralt/genişlet -->
      <button
        @click="acik = !acik"
        class="hidden lg:flex w-7 h-7 rounded-lg hover:bg-pearl-10 text-pearl-50 hover:text-gold-primary transition items-center justify-center shrink-0"
        :title="acik ? 'Daralt' : 'Genişlet'"
      >
        <i :class="['fas text-[10px]', acik ? 'fa-chevron-left' : 'fa-chevron-right']" />
      </button>
      <!-- Mobil kapat -->
      <button
        @click="mobilKapat"
        class="lg:hidden w-9 h-9 rounded-lg hover:bg-pearl-10 text-pearl-50 hover:text-gold-primary transition flex items-center justify-center shrink-0"
        title="Kapat"
      >
        <i class="fas fa-xmark" />
      </button>
    </div>

    <!-- Menü -->
    <nav class="flex-1 overflow-y-auto py-4 px-3">
      <div v-for="(g, gi) in gorunenGruplar" :key="g.ad" :class="gi > 0 && 'mt-5'">
        <div
          v-if="acik || mobilAcik"
          class="text-[9px] uppercase tracking-extra-wide text-pearl-50 px-3 mb-2 font-semibold"
        >
          {{ g.ad }}
        </div>
        <div v-else class="h-px bg-pearl-10 mx-3 mb-3" />

        <div class="space-y-0.5">
          <NuxtLink
            v-for="m in g.ogeler"
            :key="m.yol"
            :to="m.yol"
            :class="[
              'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
              aktif(m)
                ? 'text-gold-primary bg-gold-soft'
                : 'text-pearl-70 hover:text-pearl hover:bg-pearl-5',
            ]"
            :title="!acik && !mobilAcik ? m.ad : ''"
          >
            <span
              v-if="aktif(m)"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-gold-primary rounded-r-full"
            />
            <i :class="['fas', m.ikon, 'w-5 text-center shrink-0', aktif(m) ? 'text-gold-primary' : 'text-pearl-60 group-hover:text-pearl-80']" />
            <span v-if="acik || mobilAcik" class="truncate flex-1">{{ m.ad }}</span>
            <span v-if="(acik || mobilAcik) && m.rozet" class="badge-danger !py-0.5">{{ m.rozet }}</span>
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Footer -->
    <div class="border-t border-pearl-10 p-3">
      <!-- Müşteri ekranı butonu -->
      <button
        @click="musteriEkraniAc"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-pearl-70 hover:text-gold-primary hover:bg-gold-soft transition mb-2"
        :title="!acik && !mobilAcik ? 'Müşteri Ekranını Aç' : ''"
      >
        <i class="fas fa-display w-5 text-center shrink-0" />
        <span v-if="acik || mobilAcik" class="truncate flex-1 text-left">Müşteri Ekranı</span>
        <i v-if="acik || mobilAcik" class="fas fa-up-right-from-square text-[10px] text-pearl-50" />
      </button>

      <div
        v-if="acik || mobilAcik"
        class="flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl"
      >
        <div class="w-9 h-9 bg-gold-primary/15 text-gold-primary rounded-xl flex items-center justify-center font-semibold shrink-0 border border-gold-primary/20">
          {{ (auth.user?.adSoyad || '?').charAt(0).toUpperCase() }}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm font-medium text-pearl truncate">{{ auth.user?.adSoyad }}</div>
          <div class="text-[10px] text-gold-primary uppercase tracking-extra-wide truncate font-semibold">
            {{ auth.rol ? rolEtiket[auth.rol] : '' }}
          </div>
        </div>
      </div>
      <button
        @click="cikis"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-pearl-70 hover:text-red-300 hover:bg-red-500/10 transition"
        :title="!acik && !mobilAcik ? 'Çıkış' : ''"
      >
        <i class="fas fa-right-from-bracket w-5 text-center shrink-0" />
        <span v-if="acik || mobilAcik">Çıkış</span>
      </button>
    </div>
  </aside>
</template>
