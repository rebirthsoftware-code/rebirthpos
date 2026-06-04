<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ middleware: ['auth'] });

type EBelgeTip = 'E_ARSIV' | 'E_FATURA' | 'E_SMM';

interface EBelge {
  id: string;
  tip: EBelgeTip;
  durum: string;
  belgeNo: string;
  ettn: string;
  marka: string;
  aliciAd: string;
  aliciVergiNo: string | null;
  toplamTutar: string | number;
  kdvTutar: string | number;
  duzenlenmeTarihi: string;
  iptalTarihi: string | null;
  pdfUrl: string | null;
  adisyon?: { id: string; numara: string } | null;
  musteri?: { id: string; adSoyad: string; telefon: string } | null;
}

interface EBelgeDetay extends EBelge {
  aliciAdres: string | null;
  aliciEposta: string | null;
  aliciVergiDairesi: string | null;
  araToplam: string | number;
  iskontoTutar: string | number;
  kdvDokumu: Array<{ oran: number; matrah: number; kdv: number }>;
  kalemler: Array<{ ad: string; adet: number; birimFiyat: number; kdvOrani: number; toplam: number }>;
  odemeler: Array<{ tip: string; tutar: number }>;
  not: string | null;
}

const sube = useSubeStore();
const toast = useToastStore();
const belgeler = ref<EBelge[]>([]);
const yukleniyor = ref(false);
const filtreTip = ref<EBelgeTip | ''>('');
const detayModalAcik = ref(false);
const detay = ref<EBelgeDetay | null>(null);
const detayYukleniyor = ref(false);
const { onay } = useOnay();

async function yukle() {
  if (!sube.aktifSubeId) return;
  yukleniyor.value = true;
  try {
    const params = new URLSearchParams({
      subeId: sube.aktifSubeId,
      limit: '200',
    });
    if (filtreTip.value) params.set('tip', filtreTip.value);
    belgeler.value = await apiFetch<EBelge[]>(`/e-belge?${params.toString()}`);
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Faturalar yüklenemedi');
  } finally {
    yukleniyor.value = false;
  }
}

watch(() => sube.aktifSubeId, () => yukle(), { immediate: true });
watch(filtreTip, () => yukle());

async function detayAc(id: string) {
  detayYukleniyor.value = true;
  detayModalAcik.value = true;
  detay.value = null;
  try {
    detay.value = await apiFetch<EBelgeDetay>(`/e-belge/${id}`);
  } catch (e: any) {
    toast.hata(e?.data?.message || 'Detay yüklenemedi');
    detayModalAcik.value = false;
  } finally {
    detayYukleniyor.value = false;
  }
}

async function belgeIptal(id: string, belgeNo: string) {
  if (!(await onay({
    baslik: 'Belgeyi İptal Et',
    mesaj: `${belgeNo} numaralı belge GİB nezdinde iptal edilecek. Geri alınamaz. Devam edilsin mi?`,
    onayMetni: 'İptal Et',
    tehlikeli: true,
  }))) return;
  try {
    await apiFetch(`/e-belge/${id}/iptal`, { method: 'POST', body: { sebep: 'Manuel iptal' } });
    toast.basari('Belge iptal edildi');
    detayModalAcik.value = false;
    await yukle();
  } catch (e: any) {
    toast.hata(e?.data?.message || 'İptal başarısız');
  }
}

const tipler: { kod: EBelgeTip | ''; ad: string; renk: string }[] = [
  { kod: '', ad: 'Tümü', renk: 'pearl' },
  { kod: 'E_ARSIV', ad: 'e-Arşiv', renk: 'gold' },
  { kod: 'E_FATURA', ad: 'e-Fatura', renk: 'blue' },
  { kod: 'E_SMM', ad: 'e-SMM', renk: 'emerald' },
];

function tipEtiket(tip: string) {
  if (tip === 'E_ARSIV') return 'e-Arşiv';
  if (tip === 'E_FATURA') return 'e-Fatura';
  if (tip === 'E_SMM') return 'e-SMM';
  return tip;
}

function durumRenk(durum: string) {
  if (durum === 'ONAYLANDI' || durum === 'GONDERILDI') return 'badge-success';
  if (durum === 'REDDEDILDI') return 'badge-danger';
  if (durum === 'IPTAL') return 'badge bg-pearl-10 text-pearl-50';
  return 'badge-warning';
}

function tarihFmt(iso: string) {
  return new Date(iso).toLocaleString('tr-TR');
}
</script>

<template>
  <div class="flex flex-col gap-4 min-h-[calc(100vh-7.5rem)]">
    <!-- Başlık -->
    <header class="flex items-end justify-between flex-wrap gap-3">
      <div>
        <div class="text-[10px] uppercase tracking-extra-wide text-gold-dark font-semibold mb-1 flex items-center gap-2">
          <i class="fas fa-file-invoice text-xs" />
          GİB ENTEGRE · 593 No.lu VUK Tebliği
        </div>
        <h1 class="text-2xl font-light text-pearl tracking-tight">e-Belgeler</h1>
        <p class="text-xs text-pearl-60 mt-0.5">
          e-Arşiv Fatura · e-Fatura · e-SMM · GİB onaylı entegratör üzerinden düzenlenir
        </p>
      </div>
      <div class="flex items-center gap-1">
        <button
          v-for="t in tipler"
          :key="t.kod"
          @click="filtreTip = t.kod"
          :class="[
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition',
            filtreTip === t.kod
              ? 'bg-gold-soft border-gold-primary/40 text-gold-dark'
              : 'border-pearl-10 text-pearl-60 hover:border-pearl-30',
          ]"
        >
          {{ t.ad }}
        </button>
      </div>
    </header>

    <!-- Tablo -->
    <div class="surface-elevated flex-1 min-h-0 flex flex-col overflow-hidden">
      <div v-if="yukleniyor && !belgeler.length" class="flex-1 flex items-center justify-center text-pearl-50">
        <i class="fas fa-spinner fa-spin text-2xl" />
      </div>
      <EmptyState
        v-else-if="!belgeler.length"
        ikon="fa-file-invoice"
        baslik="Henüz e-Belge düzenlenmedi"
        aciklama="Adisyon detayı sayfasında 'Fatura Düzenle' butonu ile e-Arşiv veya e-Fatura oluşturabilirsiniz."
      />
      <div v-else class="flex-1 min-h-0 overflow-y-auto">
        <table class="w-full text-sm">
          <thead class="sticky top-0 bg-white z-10">
            <tr class="text-[10px] uppercase tracking-wider text-pearl-50 border-b border-pearl-10">
              <th class="text-left py-3 px-4 font-semibold">Tarih</th>
              <th class="text-left py-3 px-4 font-semibold">Tip</th>
              <th class="text-left py-3 px-4 font-semibold">Belge No</th>
              <th class="text-left py-3 px-4 font-semibold">Alıcı</th>
              <th class="text-left py-3 px-4 font-semibold">Vergi No</th>
              <th class="text-right py-3 px-4 font-semibold">Toplam</th>
              <th class="text-center py-3 px-4 font-semibold">Durum</th>
              <th class="text-center py-3 px-4 font-semibold w-12"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="b in belgeler"
              :key="b.id"
              @click="detayAc(b.id)"
              class="border-b border-pearl-5 hover:bg-pearl-5 cursor-pointer transition"
            >
              <td class="py-3 px-4 text-pearl-70 tabular text-xs">{{ tarihFmt(b.duzenlenmeTarihi) }}</td>
              <td class="py-3 px-4">
                <span
                  :class="[
                    'badge !text-[10px]',
                    b.tip === 'E_ARSIV' ? 'badge-gold' : b.tip === 'E_FATURA' ? 'badge-info' : 'badge-success',
                  ]"
                >{{ tipEtiket(b.tip) }}</span>
              </td>
              <td class="py-3 px-4 font-mono text-xs text-gold-dark">{{ b.belgeNo }}</td>
              <td class="py-3 px-4 text-pearl-80">{{ b.aliciAd }}</td>
              <td class="py-3 px-4 font-mono text-xs text-pearl-70 tabular">{{ b.aliciVergiNo || '—' }}</td>
              <td class="py-3 px-4 text-right font-bold tabular">{{ paraFormat(b.toplamTutar) }}</td>
              <td class="py-3 px-4 text-center">
                <span :class="['!text-[9px]', durumRenk(b.durum)]">{{ b.durum }}</span>
              </td>
              <td class="py-3 px-4 text-center">
                <i class="fas fa-chevron-right text-pearl-40 text-xs" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Detay modal -->
  <AppModal
    :acik="detayModalAcik"
    :baslik="detay ? `${tipEtiket(detay.tip)} · ${detay.belgeNo}` : 'Yükleniyor…'"
    genislik="max-w-2xl"
    @kapat="detayModalAcik = false"
  >
    <div v-if="detayYukleniyor || !detay" class="py-12 text-center text-pearl-50">
      <i class="fas fa-spinner fa-spin text-2xl" />
    </div>
    <div v-else class="space-y-5 text-sm">
      <!-- Durum şeridi -->
      <div class="flex items-center justify-between bg-pearl-5 rounded-xl p-3">
        <div class="flex items-center gap-2">
          <span :class="['badge !text-[10px]', durumRenk(detay.durum)]">{{ detay.durum }}</span>
          <span class="text-xs text-pearl-60">{{ detay.marka }} · ETTN {{ detay.ettn }}</span>
        </div>
        <div class="text-right">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold">Toplam</div>
          <div class="text-xl font-bold gold-text-shimmer tabular">{{ paraFormat(detay.toplamTutar) }}</div>
        </div>
      </div>

      <!-- Alıcı -->
      <div>
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Alıcı</div>
        <div class="surface-elevated p-3 text-xs space-y-1">
          <div class="font-semibold text-pearl">{{ detay.aliciAd }}</div>
          <div v-if="detay.aliciVergiNo" class="text-pearl-70">
            <span class="text-pearl-50">{{ detay.aliciVergiNo.length === 10 ? 'VKN' : 'TCKN' }}:</span>
            <span class="font-mono tabular ml-1">{{ detay.aliciVergiNo }}</span>
            <span v-if="detay.aliciVergiDairesi" class="text-pearl-50 ml-2">{{ detay.aliciVergiDairesi }}</span>
          </div>
          <div v-if="detay.aliciAdres" class="text-pearl-60">{{ detay.aliciAdres }}</div>
          <div v-if="detay.aliciEposta || detay.aliciTelefon" class="text-pearl-60 text-[11px]">
            {{ detay.aliciEposta }} <span v-if="detay.aliciEposta && detay.aliciTelefon"> · </span> {{ detay.aliciTelefon }}
          </div>
        </div>
      </div>

      <!-- Kalemler -->
      <div v-if="detay.kalemler?.length">
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Kalemler</div>
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-pearl-10 text-pearl-50 text-[10px]">
              <th class="text-left py-1.5">Ürün</th>
              <th class="text-right py-1.5 w-12">Adet</th>
              <th class="text-right py-1.5 w-20">Birim</th>
              <th class="text-right py-1.5 w-12">KDV%</th>
              <th class="text-right py-1.5 w-20">Toplam</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(k, i) in detay.kalemler" :key="i" class="border-b border-pearl-5">
              <td class="py-1.5">{{ k.ad }}</td>
              <td class="text-right py-1.5 tabular">{{ k.adet }}</td>
              <td class="text-right py-1.5 tabular">{{ paraFormat(k.birimFiyat) }}</td>
              <td class="text-right py-1.5 tabular text-pearl-70">{{ k.kdvOrani }}</td>
              <td class="text-right py-1.5 tabular font-medium">{{ paraFormat(k.toplam) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- KDV + Mali özet + Ödeme -->
      <div class="grid grid-cols-2 gap-3">
        <div v-if="detay.kdvDokumu?.length">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">KDV Dökümü</div>
          <div class="surface-elevated p-3 text-xs space-y-1">
            <div v-for="d in detay.kdvDokumu" :key="d.oran" class="flex justify-between">
              <span class="text-pearl-70">%{{ d.oran }} · {{ paraFormat(d.matrah) }}</span>
              <span class="font-mono tabular text-gold-dark">{{ paraFormat(d.kdv) }}</span>
            </div>
            <div class="flex justify-between pt-1 mt-1 border-t border-pearl-10 font-semibold">
              <span>KDV Toplam</span>
              <span class="tabular text-gold-dark">{{ paraFormat(detay.kdvTutar) }}</span>
            </div>
          </div>
        </div>
        <div v-if="detay.odemeler?.length">
          <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-2">Ödeme</div>
          <div class="surface-elevated p-3 text-xs space-y-1">
            <div v-for="(o, i) in detay.odemeler" :key="i" class="flex justify-between">
              <span class="text-pearl-70">
                <i :class="['fas mr-1', o.tip === 'NAKIT' ? 'fa-money-bill-wave text-emerald-600' : 'fa-credit-card text-blue-600']" />
                {{ o.tip === 'NAKIT' ? 'Nakit' : 'Kart' }}
              </span>
              <span class="font-mono tabular">{{ paraFormat(o.tutar) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Adisyon ref + iptal -->
      <div class="flex items-center justify-between pt-3 border-t border-pearl-10">
        <NuxtLink
          v-if="detay.adisyon"
          :to="`/adisyon/${detay.adisyon.id}`"
          class="text-xs text-gold-primary hover:underline"
        >
          <i class="fas fa-receipt mr-1" />Adisyon: {{ detay.adisyon.numara }}
        </NuxtLink>
        <span v-else class="text-xs text-pearl-50">Bağımsız belge</span>
        <button
          v-if="detay.durum !== 'IPTAL'"
          @click="belgeIptal(detay.id, detay.belgeNo)"
          class="text-xs text-red-700 hover:underline"
        >
          <i class="fas fa-ban mr-1" />Belgeyi İptal Et
        </button>
      </div>
    </div>
  </AppModal>
</template>
