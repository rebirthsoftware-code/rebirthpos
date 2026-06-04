<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

interface GunSonu {
  tarih: string;
  adisyonSayisi: number;
  toplamSatis: number;
  toplamIskonto: number;
  toplamKdv: number;
  toplamBahsis: number;
  toplamKalem: number;
  ortalamaAdisyon: number;
  odemeTipleri: { tip: string; tutar: number; sayi: number }[];
  enCokSatanlar: { urunId: string; ad: string; adet: number; tutar: number }[];
  kategoriler: { kategoriId: string | null; ad: string; adet: number; tutar: number }[];
  saatBazli: { saat: number; tutar: number }[];
}

interface Personel {
  kullaniciId: string;
  adSoyad: string;
  rol: string;
  adisyon: number;
  ciro: number;
}

const sube = useSubeStore();
const tarih = ref(new Date().toISOString().substring(0, 10));
const rapor = ref<GunSonu | null>(null);
const personel = ref<Personel[]>([]);
const yukleniyor = ref(false);

async function yukle() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const [r, p] = await Promise.all([
      apiFetch<GunSonu>(`/raporlar/gunsonu?subeId=${sube.aktifSubeId}&tarih=${tarih.value}`),
      apiFetch<Personel[]>(`/raporlar/personel?subeId=${sube.aktifSubeId}&tarih=${tarih.value}`),
    ]);
    rapor.value = r;
    personel.value = p;
  } finally {
    yukleniyor.value = false;
  }
}

watch([() => sube.aktifSubeId, tarih], () => yukle(), { immediate: true });

const odemeTipiAd: Record<string, string> = {
  NAKIT: 'Nakit',
  KREDI_KARTI: 'Kredi Kartı',
  YEMEKSEPETI: 'Yemeksepeti',
  TICKET: 'Yemek Çeki',
};

const maxSaat = computed(() => Math.max(1, ...(rapor.value?.saatBazli.map((s) => s.tutar) || [0])));
const maxUrun = computed(() => Math.max(1, ...(rapor.value?.enCokSatanlar.map((u) => u.tutar) || [0])));
</script>

<template>
  <PageHeader baslik="Raporlar" aciklama="Gün sonu özet ve performans" ikon="fa-chart-line">
    <template #actions>
      <input v-model="tarih" type="date" class="input-base !py-2 !text-sm w-auto" />
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">Önce bir şube seç</div>

  <template v-else>
    <div v-if="yukleniyor" class="text-center py-12 text-pearl-60">
      <i class="fas fa-spinner fa-spin text-2xl" />
    </div>

    <template v-else-if="rapor">
      <!-- KPI'lar -->
      <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="glass-card p-5">
          <div class="text-xs text-pearl-50 uppercase tracking-wider mb-2">Toplam Ciro</div>
          <div class="text-2xl font-bold gold-text">{{ paraFormat(rapor.toplamSatis) }}</div>
        </div>
        <div class="glass-card p-5">
          <div class="text-xs text-pearl-50 uppercase tracking-wider mb-2">Adisyon</div>
          <div class="text-2xl font-bold gold-text">{{ rapor.adisyonSayisi }}</div>
          <div class="text-[11px] text-pearl-50 mt-1">Ort: {{ paraFormat(rapor.ortalamaAdisyon) }}</div>
        </div>
        <div class="glass-card p-5">
          <div class="text-xs text-pearl-50 uppercase tracking-wider mb-2">Satılan Kalem</div>
          <div class="text-2xl font-bold gold-text">{{ rapor.toplamKalem }}</div>
        </div>
        <div class="glass-card p-5">
          <div class="text-xs text-pearl-50 uppercase tracking-wider mb-2">İskonto / Bahşiş</div>
          <div class="text-xl font-bold text-amber-300">{{ paraFormat(rapor.toplamIskonto) }}</div>
          <div class="text-[11px] text-emerald-400 mt-1">+ Bahşiş {{ paraFormat(rapor.toplamBahsis) }}</div>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <!-- Ödeme Tipleri -->
        <div class="glass-card p-5">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-credit-card text-gold-primary" /> Ödeme Tipleri
          </h3>
          <div v-if="!rapor.odemeTipleri.length" class="text-center text-pearl-50 py-6 text-sm">
            Ödeme yok
          </div>
          <div v-else class="space-y-2">
            <div v-for="o in rapor.odemeTipleri" :key="o.tip" class="flex items-center justify-between">
              <span class="text-sm">{{ odemeTipiAd[o.tip] || o.tip }}</span>
              <div class="text-right">
                <span class="font-bold gold-text">{{ paraFormat(o.tutar) }}</span>
                <span class="text-xs text-pearl-50 ml-2">({{ o.sayi }})</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Saat Bazlı Grafik -->
        <div class="glass-card p-5">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-chart-column text-gold-primary" /> Saatlik Ciro
          </h3>
          <div class="flex items-end gap-1 h-32">
            <div
              v-for="s in rapor.saatBazli"
              :key="s.saat"
              class="flex-1 group relative"
            >
              <div
                class="bg-gradient-to-t from-gold-primary to-gold-bright/70 rounded-t hover:from-gold-dark hover:to-gold-primary transition-all"
                :style="{ height: (s.tutar / maxSaat * 100) + '%' }"
                :title="`${s.saat}:00 — ${paraFormat(s.tutar)}`"
              />
            </div>
          </div>
          <div class="flex justify-between text-[10px] text-pearl-50 mt-2">
            <span>00</span><span>06</span><span>12</span><span>18</span><span>23</span>
          </div>
        </div>
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <!-- En Çok Satanlar -->
        <div class="glass-card p-5">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-fire text-gold-primary" /> En Çok Satanlar
          </h3>
          <div v-if="!rapor.enCokSatanlar.length" class="text-center text-pearl-50 py-6 text-sm">Veri yok</div>
          <div v-else class="space-y-2">
            <div v-for="(u, i) in rapor.enCokSatanlar" :key="u.urunId">
              <div class="flex items-center justify-between text-sm mb-1">
                <span class="truncate">
                  <span class="text-gold-primary font-bold mr-2">{{ i + 1 }}.</span>{{ u.ad }}
                </span>
                <span class="font-bold gold-text shrink-0">{{ paraFormat(u.tutar) }}</span>
              </div>
              <div class="h-1.5 bg-pearl-10 rounded-full overflow-hidden">
                <div class="h-full bg-gold-gradient rounded-full" :style="{ width: (u.tutar / maxUrun * 100) + '%' }" />
              </div>
              <div class="text-[10px] text-pearl-50 mt-0.5">{{ u.adet }} adet</div>
            </div>
          </div>
        </div>

        <!-- Kategori Dağılımı -->
        <div class="glass-card p-5">
          <h3 class="font-semibold mb-4 flex items-center gap-2">
            <i class="fas fa-layer-group text-gold-primary" /> Kategoriler
          </h3>
          <div v-if="!rapor.kategoriler.length" class="text-center text-pearl-50 py-6 text-sm">Veri yok</div>
          <div v-else class="space-y-2">
            <div v-for="k in rapor.kategoriler" :key="k.kategoriId || 'yok'" class="flex items-center justify-between text-sm">
              <span>{{ k.ad }}</span>
              <div>
                <span class="font-bold gold-text">{{ paraFormat(k.tutar) }}</span>
                <span class="text-xs text-pearl-50 ml-2">({{ k.adet }})</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Personel Performans -->
      <section class="glass-card p-5">
        <h3 class="font-semibold mb-4 flex items-center gap-2">
          <i class="fas fa-trophy text-gold-primary" /> Personel Performansı
        </h3>
        <div v-if="!personel.length" class="text-center text-pearl-50 py-6 text-sm">Veri yok</div>
        <div v-else class="space-y-2">
          <div v-for="(p, i) in personel.sort((a, b) => b.ciro - a.ciro)" :key="p.kullaniciId" class="flex items-center justify-between glass-card p-3">
            <div class="flex items-center gap-3">
              <div
                :class="[
                  'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold',
                  i === 0 ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40' : i === 1 ? 'bg-pearl-10 text-pearl-80 border border-pearl-20' : i === 2 ? 'bg-orange-600/20 text-orange-400 border border-orange-500/40' : 'bg-pearl-5 text-pearl-60 border border-pearl-10',
                ]"
              >
                {{ i + 1 }}
              </div>
              <div>
                <div class="font-medium">{{ p.adSoyad }}</div>
                <div class="text-[11px] text-gold-primary/70">{{ p.rol }}</div>
              </div>
            </div>
            <div class="text-right">
              <div class="font-bold gold-text">{{ paraFormat(p.ciro) }}</div>
              <div class="text-[11px] text-pearl-50">{{ p.adisyon }} adisyon</div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </template>
</template>
