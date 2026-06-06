<script setup lang="ts">
import { paraFormat } from '~/utils/format';

definePageMeta({ layout: false });

// ─────────────────────────────────────────────────────────────
// PayTR Sanal POS — TEST ÖDEME SAYFASI
// Gerçek PayTR entegre bilgileri (merchant_id/key/salt) gelene kadar online
// ödeme bu sayfa üzerinden simüle edilir. Gerçek PayTR'de bu ekranın yerini
// PayTR'nin güvenli iframe'i alır; akışın geri kalanı (qr/odeme/sonuc) aynıdır.
// ─────────────────────────────────────────────────────────────

const route = useRoute();

const token = route.query.token as string;
const subeId = route.query.subeId as string;
const masaId = (route.query.masa as string) || '';
const adisyonId = route.query.adisyonId as string;
const tutar = Number(route.query.tutar || 0);
const ad = (route.query.ad as string) || '';
const firma = (route.query.firma as string) || '';
const sube = (route.query.sube as string) || '';
const masaAd = (route.query.masaAd as string) || '';
const testMod = (route.query.testMod as string) || '';
const saglayici = (route.query.saglayici as string) || 'MOCK';

// Test kart bilgileri (önceden dolu — sadece görsel simülasyon)
const kartNo = ref('4355 0843 5508 4358');
const sonKullanma = ref('12/30');
const cvv = ref('000');
const kartSahibi = ref(ad || 'TEST KART');

const isleniyor = ref(false);
const hata = ref('');

const gecersiz = computed(() => !token || !subeId || !adisyonId || tutar <= 0);

async function sonucGonder(basariliMi: boolean) {
  if (isleniyor.value) return;
  isleniyor.value = true;
  hata.value = '';
  try {
    const config = useRuntimeConfig();
    const yanit = await $fetch<{ basarili: boolean; durum: string; hata?: string }>(
      '/qr/odeme/sonuc',
      {
        baseURL: config.public.apiBase,
        method: 'POST',
        body: { subeId, adisyonId, tutar, token, basariliMi },
      },
    );
    const sonuc = yanit.basarili ? 'basarili' : 'basarisiz';
    await navigateTo({ path: `/qr/${subeId}`, query: { masa: masaId || undefined, odeme: sonuc } });
  } catch (e: any) {
    hata.value = e?.data?.message || 'Ödeme işlenemedi. Lütfen tekrar deneyin.';
    isleniyor.value = false;
  }
}
</script>

<template>
  <Html lang="tr">
    <Head><Title>Güvenli Ödeme · PayTR</Title></Head>
  </Html>

  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="w-full max-w-md">
      <!-- Test rozeti -->
      <div class="mb-3 flex items-center justify-center gap-2 text-xs">
        <span class="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 font-medium">
          <i class="fas fa-flask mr-1" />TEST ORTAMI
        </span>
        <span v-if="testMod" class="px-2.5 py-1 rounded-full bg-glass-border/40 border border-glass-border text-pearl-60">
          mod: {{ testMod }}
        </span>
      </div>

      <div class="glass-card overflow-hidden">
        <!-- PayTR başlık -->
        <div class="bg-gradient-to-r from-[#1b2a4a] to-[#0e1830] p-5 flex items-center justify-between border-b border-glass-border">
          <div class="flex items-center gap-2">
            <div class="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white">
              <i class="fas fa-shield-halved" />
            </div>
            <div>
              <div class="font-bold text-white tracking-wide">PayTR</div>
              <div class="text-[10px] text-pearl-50 uppercase tracking-widest">Güvenli Sanal POS</div>
            </div>
          </div>
          <div class="text-right text-xs text-pearl-50">
            <i class="fas fa-lock mr-1 text-emerald-400" />3D Secure
          </div>
        </div>

        <div v-if="gecersiz" class="p-8 text-center">
          <i class="fas fa-triangle-exclamation text-3xl text-red-400 mb-3 block" />
          <p class="text-red-300">Geçersiz ödeme isteği. Lütfen menüden tekrar deneyin.</p>
          <NuxtLink :to="`/qr/${subeId}`" class="btn-gold !w-full mt-5">Menüye Dön</NuxtLink>
        </div>

        <template v-else>
          <!-- İşletme + tutar -->
          <div class="p-5 border-b border-glass-border">
            <div class="flex items-center justify-between text-sm">
              <span class="text-pearl-60">İşletme</span>
              <span class="font-medium text-right">{{ firma }} <span v-if="sube" class="text-pearl-50">· {{ sube }}</span></span>
            </div>
            <div v-if="masaAd" class="flex items-center justify-between text-sm mt-1">
              <span class="text-pearl-60">Masa</span>
              <span class="font-medium">{{ masaAd }}</span>
            </div>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-glass-border">
              <span class="text-pearl-60">Ödenecek Tutar</span>
              <span class="text-2xl font-bold gold-text">{{ paraFormat(tutar) }}</span>
            </div>
          </div>

          <!-- Kart formu (test) -->
          <div class="p-5 space-y-3">
            <div>
              <label class="text-xs text-pearl-60 mb-1 block">Kart Numarası</label>
              <input v-model="kartNo" class="input-base font-mono tracking-wider" inputmode="numeric" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-pearl-60 mb-1 block">Son Kul. (AA/YY)</label>
                <input v-model="sonKullanma" class="input-base font-mono" />
              </div>
              <div>
                <label class="text-xs text-pearl-60 mb-1 block">CVV</label>
                <input v-model="cvv" class="input-base font-mono" maxlength="4" />
              </div>
            </div>
            <div>
              <label class="text-xs text-pearl-60 mb-1 block">Kart Sahibi</label>
              <input v-model="kartSahibi" class="input-base uppercase" />
            </div>

            <p v-if="hata" class="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl p-3">
              <i class="fas fa-circle-exclamation mr-1.5" />{{ hata }}
            </p>

            <button @click="sonucGonder(true)" :disabled="isleniyor" class="btn-gold w-full !py-3.5">
              <i v-if="isleniyor" class="fas fa-spinner fa-spin mr-2" />
              <i v-else class="fas fa-lock mr-2" />
              {{ isleniyor ? 'İşleniyor...' : `${paraFormat(tutar)} Öde` }}
            </button>

            <!-- Test kontrolleri -->
            <div class="pt-2 border-t border-glass-border">
              <p class="text-[11px] text-pearl-50 mb-2 text-center uppercase tracking-wider">Test Kontrolleri</p>
              <div class="grid grid-cols-2 gap-2">
                <button
                  @click="sonucGonder(true)"
                  :disabled="isleniyor"
                  class="text-xs py-2.5 rounded-xl border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 transition"
                >
                  <i class="fas fa-check mr-1" />Başarılı simüle et
                </button>
                <button
                  @click="sonucGonder(false)"
                  :disabled="isleniyor"
                  class="text-xs py-2.5 rounded-xl border border-red-500/40 text-red-300 hover:bg-red-500/10 transition"
                >
                  <i class="fas fa-xmark mr-1" />Başarısız simüle et
                </button>
              </div>
            </div>

            <NuxtLink :to="`/qr/${subeId}?masa=${masaId}`" class="block text-center text-sm text-pearl-60 hover:text-gold-primary pt-1">
              <i class="fas fa-arrow-left mr-1" />Vazgeç, menüye dön
            </NuxtLink>
          </div>
        </template>
      </div>

      <p class="text-center text-[11px] text-pearl-40 mt-4">
        Sağlayıcı: {{ saglayici }} · Bu bir test ödeme ekranıdır, gerçek tahsilat yapılmaz.
      </p>
    </div>
  </div>
</template>
