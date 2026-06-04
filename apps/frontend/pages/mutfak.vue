<script setup lang="ts">
import { gecenSure, saatFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface Kalem {
  id: string;
  adet: number;
  not?: string | null;
  iptal: boolean;
  urun: { id: string; ad: string };
}

interface Siparis {
  id: string;
  subeId: string;
  durum: 'ALINDI' | 'HAZIRLANIYOR' | 'HAZIR' | 'TESLIM_EDILDI' | 'IPTAL';
  kaynak: string;
  not?: string | null;
  olusturuldu: string;
  kalemler: Kalem[];
  adisyon: { id: string; numara: string; masa?: { id: string; ad: string } | null };
  kullanici: { adSoyad: string };
}

const sube = useSubeStore();
const siparisler = ref<Siparis[]>([]);
const yukleniyor = ref(false);
const hata = ref('');
const { on, subeOdasinaKatil } = useSocket();

async function listele() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    siparisler.value = await apiFetch<Siparis[]>(
      `/siparisler?subeId=${sube.aktifSubeId}&durumlar=ALINDI,HAZIRLANIYOR,HAZIR`,
    );
  } catch (e: any) {
    hata.value = e?.data?.message || 'Yüklenemedi';
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, (id) => {
  if (id) subeOdasinaKatil(id);
  listele();
}, { immediate: true });

onMounted(() => {
  listele();
  // Yeni sipariş veya durum değişimi geldiğinde yeniden çek
  const off1 = on('siparis:yeni', () => {
    bipCal();
    listele();
  });
  const off2 = on('siparis:guncel', () => listele());
  onUnmounted(() => {
    off1?.();
    off2?.();
  });
});

// Sipariş bildirimi sesi
function bipCal() {
  if (!import.meta.client) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    osc.type = 'sine';
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

const guncelleniyor = ref<string>('');

async function durumIlerlet(s: Siparis) {
  guncelleniyor.value = s.id;
  const sonraki: Record<string, string> = {
    ALINDI: 'HAZIRLANIYOR',
    HAZIRLANIYOR: 'HAZIR',
    HAZIR: 'TESLIM_EDILDI',
  };
  const yeni = sonraki[s.durum];
  if (!yeni) return;
  try {
    await apiFetch(`/siparisler/${s.id}/durum`, {
      method: 'PATCH',
      body: { durum: yeni },
    });
    await listele();
  } catch (e: any) {
    useToastStore().hata(e?.data?.message || 'Güncellenemedi');
  } finally {
    guncelleniyor.value = '';
  }
}

const gruplu = computed(() => {
  const m: Record<string, Siparis[]> = { ALINDI: [], HAZIRLANIYOR: [], HAZIR: [] };
  for (const s of siparisler.value) {
    if (m[s.durum]) m[s.durum].push(s);
  }
  return m;
});

const sutunlar = [
  { durum: 'ALINDI', baslik: 'Yeni Siparişler', ikon: 'fa-bell', renk: 'border-emerald-500/50 bg-emerald-500/10', textRenk: 'text-emerald-300', buton: 'Hazırlamaya Başla', butonIkon: 'fa-fire' },
  { durum: 'HAZIRLANIYOR', baslik: 'Hazırlanıyor', ikon: 'fa-fire', renk: 'border-amber-500/50 bg-amber-500/10', textRenk: 'text-amber-300', buton: 'Hazır', butonIkon: 'fa-check' },
  { durum: 'HAZIR', baslik: 'Hazır', ikon: 'fa-check-circle', renk: 'border-blue-500/50 bg-blue-500/10', textRenk: 'text-blue-300', buton: 'Teslim Edildi', butonIkon: 'fa-truck' },
];

// Her saniye 'gecenSure' yenilensin
const tik = ref(0);
let tickTimer: any;
onMounted(() => {
  tickTimer = setInterval(() => tik.value++, 30000);
});
onUnmounted(() => clearInterval(tickTimer));
</script>

<template>
  <PageHeader baslik="Mutfak Ekranı" aciklama="Gerçek zamanlı sipariş kuyruğu" ikon="fa-fire">
    <template #actions>
      <span class="text-sm text-pearl-60">
        <i class="fas fa-circle text-emerald-400 text-[8px] mr-1.5 animate-pulse" />
        Canlı bağlantı aktif
      </span>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">
    Önce bir şube seç
  </div>

  <div v-else-if="hata" class="glass-card p-6 border-red-500/30 text-red-300">
    <i class="fas fa-exclamation-triangle mr-2" />{{ hata }}
  </div>

  <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div
      v-for="s in sutunlar"
      :key="s.durum"
      :class="['glass-card p-4 min-h-[60vh] border-2', s.renk]"
    >
      <div class="flex items-center justify-between mb-4 pb-3 border-b border-pearl-10">
        <h3 :class="['font-semibold flex items-center gap-2', s.textRenk]">
          <i :class="['fas', s.ikon]" />
          {{ s.baslik }}
        </h3>
        <span :class="['text-xs px-2 py-0.5 rounded-full bg-pearl-5', s.textRenk]">
          {{ gruplu[s.durum].length }}
        </span>
      </div>

      <div v-if="!gruplu[s.durum].length" class="text-center py-8 text-pearl-50 text-sm">
        <i class="fas fa-circle-check text-3xl text-emerald-300 mb-2 block" />
        Boş
      </div>

      <TransitionGroup
        v-else
        tag="div"
        class="space-y-3"
        enter-active-class="transition duration-300"
        enter-from-class="opacity-0 -translate-y-2"
        leave-active-class="transition duration-200"
        leave-to-class="opacity-0 translate-x-4"
      >
        <article
          v-for="sip in gruplu[s.durum]"
          :key="sip.id"
          class="glass-card p-4 hover:border-gold-primary/40 transition"
        >
          <div class="flex items-start justify-between mb-3 pb-3 border-b border-pearl-10">
            <div>
              <div class="flex items-center gap-2">
                <span class="font-bold text-lg gold-text">
                  {{ sip.adisyon.masa?.ad || 'Masasız' }}
                </span>
                <span
                  v-if="sip.kaynak === 'QR_MENU'"
                  class="text-[10px] uppercase bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full"
                  title="QR Menüden geldi"
                >
                  <i class="fas fa-qrcode mr-1" />QR
                </span>
              </div>
              <div class="text-[11px] text-pearl-50">{{ sip.adisyon.numara }}</div>
            </div>
            <div class="text-right text-[11px] text-pearl-50" :title="saatFormat(sip.olusturuldu)">
              <i class="fas fa-clock mr-1" />
              <span :key="tik">{{ gecenSure(sip.olusturuldu) }}</span>
            </div>
          </div>

          <ul class="space-y-1.5 mb-3">
            <li
              v-for="k in sip.kalemler.filter((x: Kalem) => !x.iptal)"
              :key="k.id"
              class="flex items-start gap-2 text-sm"
            >
              <span class="text-gold-primary font-bold w-7 text-right shrink-0">{{ k.adet }}×</span>
              <div class="flex-1 min-w-0">
                <div class="leading-snug">{{ k.urun.ad }}</div>
                <div v-if="k.not" class="text-[11px] text-amber-300 mt-0.5">
                  <i class="fas fa-note-sticky" /> {{ k.not }}
                </div>
              </div>
            </li>
          </ul>

          <div v-if="sip.not" class="text-[11px] text-pearl-60 mb-3 px-2 py-1.5 rounded bg-pearl-5">
            <i class="fas fa-comment-dots mr-1.5 text-gold-primary" />{{ sip.not }}
          </div>

          <button
            @click="durumIlerlet(sip)"
            :disabled="guncelleniyor === sip.id"
            :class="['w-full py-2.5 rounded-xl text-sm font-medium transition border', s.textRenk, 'border-current hover:bg-current/10']"
          >
            <i v-if="guncelleniyor === sip.id" class="fas fa-spinner fa-spin mr-2" />
            <i v-else :class="['fas', s.butonIkon, 'mr-2']" />
            {{ s.buton }}
          </button>
        </article>
      </TransitionGroup>
    </div>
  </div>
</template>
