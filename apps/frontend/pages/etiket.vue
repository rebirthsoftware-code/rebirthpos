<script setup lang="ts">
import { carpanliKod, okutulanUrunuBul } from '~/utils/barkod';
import { paraFormat } from '~/utils/format';
import type { EtiketUrun } from '~/composables/useEtiket';

definePageMeta({ middleware: ['auth'] });

const sube = useSubeStore();
const toast = useToastStore();
const { kuyruk, ayar, ekle, etiketHtml, etiketCss, yazdir } = useEtiket();

const urunler = ref<EtiketUrun[]>([]);
const okut = ref('');
const okutInput = ref<HTMLInputElement | null>(null);
const varsayilanAdet = ref(1);

async function yukle() {
  if (!sube.aktifSubeId) return;
  urunler.value = await apiFetch<EtiketUrun[]>(`/urunler?subeId=${sube.aktifSubeId}`);
}
watch(() => sube.aktifSubeId, () => yukle(), { immediate: true });

const oneriler = computed(() => {
  const { kod } = carpanliKod(okut.value);
  if (kod.length < 2 || /^\d{6,}$/.test(kod)) return [];
  const q = kod.toLocaleLowerCase('tr');
  return urunler.value.filter((u) => u.ad.toLocaleLowerCase('tr').includes(q) || u.barkod?.includes(q)).slice(0, 8);
});

function sec(u: EtiketUrun, miktar: number | null) {
  if (ekle(u, Math.max(1, Math.round(miktar ?? varsayilanAdet.value)))) okut.value = '';
  okutInput.value?.focus();
}

function okutEnter() {
  const { miktar, kod } = carpanliKod(okut.value);
  const u = okutulanUrunuBul(urunler.value, kod);
  if (u) return sec(u, miktar);
  toast.hata(`"${kod}" bulunamadı`);
  okut.value = '';
}

function stoktakileriEkle() {
  let n = 0;
  for (const u of urunler.value) {
    if (u.barkod && u.stokTakibi && Number(u.stok) > 0) { ekle(u, Math.ceil(Number(u.stok))); n++; }
  }
  toast.basari(`${n} ürün stok adedi kadar eklendi`);
}

function adetDegis(i: number, v: string) {
  const liste = [...kuyruk.value];
  liste[i] = { ...liste[i], adet: Math.max(0, Math.round(Number(v) || 0)) };
  kuyruk.value = liste;
}
function cikar(i: number) {
  const liste = [...kuyruk.value];
  liste.splice(i, 1);
  kuyruk.value = liste;
}

const toplamEtiket = computed(() => kuyruk.value.reduce((t, k) => t + k.adet, 0));
const onizleme = computed(() => kuyruk.value.slice(0, 12).map((k) => etiketHtml(k.urun, ayar.value)).join(''));
useHead({ style: [{ key: 'etiket-onizleme', innerHTML: `${etiketCss} .onizleme .etiket{border:1px dashed #bbb}` }] });

const hazirBoyutlar = [[40, 20], [50, 30], [58, 40], [70, 40], [100, 50]] as const;
</script>

<template>
  <PageHeader baslik="Barkod Etiketi" aciklama="Ürünlere barkod + fiyat etiketi bas" ikon="fa-barcode">
    <template #actions>
      <button @click="stoktakileriEkle" class="btn-ghost !w-auto !py-2.5 !px-4" title="Stok takipli ürünleri stok adedi kadar ekle">
        <i class="fas fa-boxes-stacked mr-2" />Stok kadar ekle
      </button>
      <button @click="yazdir" :disabled="!toplamEtiket" class="btn-gold !w-auto !py-2.5 !px-5">
        <i class="fas fa-print mr-2" />Yazdır ({{ toplamEtiket }})
      </button>
    </template>
  </PageHeader>

  <div v-if="!sube.aktifSubeId" class="glass-card p-8 text-center text-pearl-60">Önce bir şube seç</div>

  <div v-else class="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
    <section class="xl:col-span-8 space-y-4 min-w-0">
      <div class="relative">
        <div class="flex gap-2">
          <div class="relative flex-1">
            <i class="fas fa-barcode absolute left-4 top-1/2 -translate-y-1/2 text-gold-primary" />
            <input
              ref="okutInput"
              v-model="okut"
              @keydown.enter.prevent="okutEnter"
              class="input-base pl-11 text-lg"
              placeholder="Barkod okutun veya ürün adı yazın… (5*barkod = 5 etiket)"
              autocomplete="off"
              autofocus
            />
          </div>
          <input v-model.number="varsayilanAdet" type="number" min="1" class="input-base !w-24 text-center" title="Her okutmada eklenecek etiket adedi" />
        </div>
        <div v-if="oneriler.length" class="absolute z-20 left-0 right-0 mt-1 glass-card p-1 max-h-72 overflow-auto">
          <button
            v-for="u in oneriler"
            :key="u.id"
            @mousedown.prevent="sec(u, carpanliKod(okut).miktar)"
            class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-glass-hover text-left"
          >
            <span class="truncate">{{ u.ad }} <span class="text-xs text-pearl-50 font-mono">{{ u.barkod || 'barkod yok' }}</span></span>
            <span class="gold-text font-semibold tabular shrink-0">{{ paraFormat(u.fiyat) }}</span>
          </button>
        </div>
      </div>

      <div class="glass-card overflow-x-auto">
        <EmptyState
          v-if="!kuyruk.length"
          ikon="fa-barcode"
          baslik="Etiket kuyruğu boş"
          aciklama="Barkod okutun, ya da Ürünler / Stok ekranından etiket ekleyin"
        />
        <table v-else class="w-full text-sm">
          <thead class="text-xs text-pearl-50 uppercase">
            <tr class="border-b border-glass-border">
              <th class="text-left p-3">Ürün</th>
              <th class="text-right p-3">Fiyat</th>
              <th class="text-right p-3">Elde</th>
              <th class="text-right p-3">Etiket</th>
              <th class="p-3" />
            </tr>
          </thead>
          <tbody>
            <tr v-for="(k, i) in kuyruk" :key="k.urun.id" class="border-b border-glass-border last:border-0">
              <td class="p-3">
                <div class="font-semibold">{{ k.urun.ad }}</div>
                <div class="text-xs text-pearl-50 font-mono">{{ k.urun.barkod }}</div>
              </td>
              <td class="p-3 text-right tabular">{{ paraFormat(k.urun.fiyat) }}</td>
              <td class="p-3 text-right tabular text-pearl-60">{{ k.urun.stokTakibi ? `${Number(k.urun.stok)} ${k.urun.stokBirim}` : '—' }}</td>
              <td class="p-3 text-right">
                <input :value="k.adet" @change="adetDegis(i, ($event.target as HTMLInputElement).value)" type="number" min="0" class="input-base !w-20 !py-1.5 text-right" />
              </td>
              <td class="p-3 text-right">
                <button @click="cikar(i)" class="text-pearl-60 hover:text-red-300 p-1"><i class="fas fa-xmark" /></button>
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="kuyruk.length" class="flex justify-between items-center p-3 border-t border-glass-border text-sm">
          <span class="text-pearl-60">{{ kuyruk.length }} ürün · {{ toplamEtiket }} etiket</span>
          <button @click="kuyruk = []" class="text-xs text-pearl-50 hover:text-red-300">Kuyruğu temizle</button>
        </div>
      </div>

      <div v-if="kuyruk.length" class="glass-card p-4">
        <div class="text-xs text-pearl-50 uppercase tracking-wider mb-3">Önizleme (her üründen bir örnek)</div>
        <div class="onizleme flex flex-wrap gap-3 p-3 rounded-xl bg-ink-300/60" v-html="onizleme" />
      </div>
    </section>

    <aside class="xl:col-span-4 glass-card p-5 space-y-4">
      <h3 class="font-semibold gold-text"><i class="fas fa-sliders mr-2" />Etiket Ayarları</h3>
      <div>
        <label class="block text-sm text-pearl-60 mb-2">Yazıcı tipi</label>
        <select v-model="ayar.mod" class="input-base">
          <option value="rulo">Etiket yazıcısı (rulo, sayfa başına 1 etiket)</option>
          <option value="a4">A4 etiket kâğıdı (ızgara)</option>
        </select>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Genişlik (mm)</label>
          <input v-model.number="ayar.gen" type="number" min="20" class="input-base" />
        </div>
        <div>
          <label class="block text-sm text-pearl-60 mb-2">Yükseklik (mm)</label>
          <input v-model.number="ayar.yuk" type="number" min="10" class="input-base" />
        </div>
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="[g, y] in hazirBoyutlar"
          :key="`${g}x${y}`"
          @click="ayar.gen = g; ayar.yuk = y"
          :class="['px-2.5 py-1 rounded-lg text-xs border transition', ayar.gen === g && ayar.yuk === y ? 'bg-gold-primary/15 border-gold-primary/40 text-gold-primary' : 'border-glass-border text-pearl-60']"
        >{{ g }}×{{ y }}</button>
      </div>
      <div v-if="ayar.mod === 'a4'" class="grid grid-cols-3 gap-3">
        <div><label class="block text-xs text-pearl-60 mb-2">Sütun</label><input v-model.number="ayar.sutun" type="number" min="1" class="input-base" /></div>
        <div><label class="block text-xs text-pearl-60 mb-2">Aralık mm</label><input v-model.number="ayar.bosluk" type="number" min="0" class="input-base" /></div>
        <div><label class="block text-xs text-pearl-60 mb-2">Kenar mm</label><input v-model.number="ayar.kenar" type="number" min="0" class="input-base" /></div>
      </div>
      <div class="space-y-2">
        <label class="flex items-center gap-2 text-sm cursor-pointer"><input v-model="ayar.adGoster" type="checkbox" class="accent-gold-primary w-4 h-4" /> Ürün adını yaz</label>
        <label class="flex items-center gap-2 text-sm cursor-pointer"><input v-model="ayar.fiyatGoster" type="checkbox" class="accent-gold-primary w-4 h-4" /> Fiyatı yaz</label>
        <label class="flex items-center gap-2 text-sm cursor-pointer"><input v-model="ayar.kodGoster" type="checkbox" class="accent-gold-primary w-4 h-4" /> Barkod numarasını yaz</label>
      </div>
      <p class="text-xs text-pearl-50 leading-relaxed">
        Yazdırma penceresinde <b>Kenar boşlukları: Yok</b> ve <b>Ölçek: %100</b> seçin. Etiket yazıcısında kâğıt boyutunu etiket ölçüsüne ayarlayın.
      </p>
    </aside>
  </div>
</template>
