<script setup lang="ts">
// Masa / menü için QR kodu üretir, gösterir, kopyalar, yazdırır, indirir.
// QR client-side üretilir (qrcode paketi) — link hiçbir 3. servise gitmez.

const props = defineProps<{
  acik: boolean;
  baslik?: string;
  altBaslik?: string;
  link: string;
}>();

const emit = defineEmits<{ (e: 'kapat'): void }>();

const toast = useToastStore();
const dataUrl = ref('');
const uretiliyor = ref(false);

async function uret() {
  if (!props.link) {
    dataUrl.value = '';
    return;
  }
  uretiliyor.value = true;
  try {
    const QR = (await import('qrcode')).default;
    dataUrl.value = await QR.toDataURL(props.link, {
      width: 520,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#1c1c20', light: '#ffffff' },
    });
  } catch (e: any) {
    toast.hata('QR üretilemedi');
  } finally {
    uretiliyor.value = false;
  }
}

watch(() => [props.acik, props.link], () => { if (props.acik) uret(); }, { immediate: true });

async function kopyala() {
  try {
    await navigator.clipboard.writeText(props.link);
    toast.basari('Link kopyalandı');
  } catch {
    toast.hata('Kopyalanamadı — linki elle seçip kopyalayın');
  }
}

function indir() {
  if (!dataUrl.value) return;
  const a = document.createElement('a');
  a.href = dataUrl.value;
  a.download = `qr-${(props.baslik || 'menu').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
  a.click();
}

function yazdir() {
  if (!dataUrl.value || !import.meta.client) return;
  const w = window.open('', '_blank', 'width=420,height=620');
  if (!w) {
    toast.hata('Yazdırma penceresi açılamadı (pop-up engeli?)');
    return;
  }
  const baslik = props.baslik || 'Menü';
  const alt = props.altBaslik || '';
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${baslik}</title>
    <style>
      *{box-sizing:border-box} body{font-family:system-ui,Segoe UI,Arial,sans-serif;margin:0;padding:32px;text-align:center;color:#1c1c20}
      .ust{font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9a7b2e;margin-bottom:6px}
      h1{font-size:26px;margin:0 0 4px} .alt{color:#666;margin-bottom:20px;font-size:14px}
      img{width:300px;height:300px} .yonerge{margin-top:18px;font-size:15px;font-weight:600}
      .kucuk{margin-top:6px;font-size:12px;color:#888}
      @media print{body{padding:0}}
    </style></head><body>
      <div class="ust">QR Menü · Sipariş & Ödeme</div>
      <h1>${baslik}</h1>
      ${alt ? `<div class="alt">${alt}</div>` : ''}
      <img src="${dataUrl.value}" alt="QR" />
      <div class="yonerge">Telefon kameranızla okutun</div>
      <div class="kucuk">Menüyü görüntüleyin, sipariş verin, masadan ödeyin</div>
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script>
    </body></html>`);
  w.document.close();
}
</script>

<template>
  <AppModal :acik="acik" :baslik="baslik || 'QR Kod'" genislik="max-w-sm" @kapat="emit('kapat')">
    <div class="text-center space-y-4">
      <div v-if="altBaslik" class="text-sm text-pearl-60 -mt-2">{{ altBaslik }}</div>

      <div class="flex items-center justify-center">
        <div class="bg-white p-3 rounded-2xl shadow-inner inline-block">
          <div v-if="uretiliyor || !dataUrl" class="w-[260px] h-[260px] flex items-center justify-center text-pearl-40">
            <i class="fas fa-spinner fa-spin text-2xl" />
          </div>
          <img v-else :src="dataUrl" alt="QR kod" class="w-[260px] h-[260px] block" />
        </div>
      </div>

      <div class="bg-pearl-5 border border-pearl-10 rounded-xl px-3 py-2 text-[11px] text-pearl-70 break-all select-all">
        {{ link }}
      </div>

      <div class="grid grid-cols-3 gap-2">
        <button @click="kopyala" class="btn-ghost !py-2 !text-xs">
          <i class="fas fa-copy mr-1" />Kopyala
        </button>
        <button @click="indir" :disabled="!dataUrl" class="btn-ghost !py-2 !text-xs">
          <i class="fas fa-download mr-1" />İndir
        </button>
        <button @click="yazdir" :disabled="!dataUrl" class="btn-gold !py-2 !text-xs">
          <i class="fas fa-print mr-1" />Yazdır
        </button>
      </div>
    </div>
  </AppModal>
</template>
