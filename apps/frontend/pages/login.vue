<script setup lang="ts">
definePageMeta({ middleware: ['auth'], layout: false });

const auth = useAuthStore();
const eposta = ref('admin@rebirth.com');
const sifre = ref('admin123');
const sifreGoster = ref(false);
const yukleniyor = ref(false);
const hata = ref('');

async function girisYap() {
  hata.value = '';
  yukleniyor.value = true;
  try {
    await auth.login(eposta.value, sifre.value);
    await navigateTo('/');
  } catch (e: any) {
    hata.value = e?.data?.message || 'Giriş başarısız. Bilgileri kontrol edin.';
  } finally {
    yukleniyor.value = false;
  }
}
</script>

<template>
  <div
    class="min-h-screen flex items-center justify-center p-5 relative overflow-hidden"
    style="background: radial-gradient(ellipse 60% 60% at 50% 20%, rgba(200,154,42,0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 100% 100%, rgba(230,196,82,0.10) 0%, transparent 55%), linear-gradient(180deg, #fdfcf9 0%, #f5f3ed 100%);"
  >
    <!-- Mesh arka plan -->
    <div class="absolute inset-0 pointer-events-none">
      <div class="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] bg-gold-primary/[0.14] blur-[140px] rounded-full animate-float" />
      <div class="absolute bottom-0 right-0 w-[500px] h-[500px] bg-gold-bright/[0.10] blur-[100px] rounded-full" />
      <div class="absolute top-1/4 left-0 w-[400px] h-[400px] bg-gold-primary/[0.08] blur-[120px] rounded-full" />
      <!-- Nokta deseni -->
      <div
        class="absolute inset-0 opacity-50"
        style="background-image: radial-gradient(rgba(200,154,42,0.15) 1px, transparent 1px); background-size: 28px 28px; mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);"
      />
    </div>

    <!-- Üst altın çubuk -->
    <div class="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/70 to-transparent" />

    <div class="w-full max-w-md relative z-10 animate-slide-up">
      <!-- Logo bölümü -->
      <div class="text-center mb-10 sm:mb-12">
        <div class="inline-flex items-center justify-center w-20 h-20 mb-6 relative">
          <!-- Dönen halka -->
          <div class="absolute inset-0 rounded-3xl border border-gold-primary/30 rotate-45" />
          <div class="absolute inset-1 rounded-2xl border border-gold-primary/20 -rotate-12" />
          <div class="absolute inset-2 bg-gradient-to-br from-gold-primary/25 to-gold-primary/5 rounded-2xl rotate-12" />
          <i class="fas fa-utensils text-3xl text-gold-primary relative z-10" />
          <!-- Pulse halka -->
          <div class="absolute -inset-2 rounded-3xl border border-gold-primary/20 animate-pulse-gold" />
        </div>
        <h1 class="text-4xl font-extralight tracking-extra-wide text-pearl mb-2">
          REBIRTH
        </h1>
        <div class="flex items-center justify-center gap-3 text-[10px] uppercase tracking-extra-wide text-pearl-50">
          <span class="w-10 h-px bg-gradient-to-r from-transparent to-gold-primary/40" />
          <span class="text-gold-light">POS Sistemi</span>
          <span class="w-10 h-px bg-gradient-to-l from-transparent to-gold-primary/40" />
        </div>
      </div>

      <!-- Form kartı -->
      <div class="surface-elevated p-7 sm:p-10 relative overflow-hidden">
        <!-- Üst altın çizgi -->
        <div class="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-gold-bright/70 to-transparent" />
        <!-- Sol üst köşe parıltı -->
        <div class="absolute top-0 left-0 w-32 h-32 bg-gold-primary/[0.05] blur-2xl rounded-full pointer-events-none" />

        <div class="relative">
          <h2 class="text-xl font-light text-pearl mb-1 tracking-tight">Hoş Geldiniz</h2>
          <p class="text-sm text-pearl-60 mb-7 sm:mb-8">Hesabınıza giriş yapın</p>

          <form @submit.prevent="girisYap" class="space-y-5">
            <div>
              <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">
                E-posta
              </label>
              <div class="relative">
                <i class="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-pearl-40 text-sm" />
                <input
                  v-model="eposta"
                  type="email"
                  required
                  autocomplete="username"
                  placeholder="ornek@firma.com"
                  class="input-base pl-11"
                />
              </div>
            </div>

            <div>
              <label class="block text-[11px] uppercase tracking-extra-wide text-pearl-60 mb-2 font-semibold">
                Şifre
              </label>
              <div class="relative">
                <i class="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-pearl-40 text-sm" />
                <input
                  v-model="sifre"
                  :type="sifreGoster ? 'text' : 'password'"
                  required
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="input-base pl-11 pr-12"
                />
                <button
                  type="button"
                  @click="sifreGoster = !sifreGoster"
                  class="absolute right-4 top-1/2 -translate-y-1/2 text-pearl-50 hover:text-gold-primary transition"
                  :aria-label="sifreGoster ? 'Şifreyi gizle' : 'Şifreyi göster'"
                >
                  <i :class="['fas', sifreGoster ? 'fa-eye-slash' : 'fa-eye']" />
                </button>
              </div>
            </div>

            <Transition
              enter-active-class="transition duration-200"
              leave-active-class="transition duration-150"
              enter-from-class="opacity-0 -translate-y-2"
              leave-to-class="opacity-0"
            >
              <div
                v-if="hata"
                class="flex items-start gap-3 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3"
              >
                <i class="fas fa-exclamation-circle text-red-400 mt-0.5 shrink-0" />
                <span class="text-sm text-red-300">{{ hata }}</span>
              </div>
            </Transition>

            <button type="submit" :disabled="yukleniyor" class="btn-gold mt-2">
              <span v-if="yukleniyor" class="flex items-center justify-center gap-2">
                <i class="fas fa-spinner fa-spin" />Giriş yapılıyor…
              </span>
              <span v-else class="flex items-center justify-center gap-2">
                Giriş Yap
                <i class="fas fa-arrow-right text-sm" />
              </span>
            </button>
          </form>

          <div class="divider-gold !my-7" />

          <div class="text-center">
            <p class="text-[10px] uppercase tracking-extra-wide text-pearl-50 mb-3 font-semibold">
              Demo Hesaplar
            </p>
            <div class="grid grid-cols-1 gap-1.5 text-[11px] text-pearl-60">
              <div class="font-mono">
                <span class="text-gold-light">admin@rebirth.com</span>
                <span class="text-pearl-40 mx-2">·</span>
                <span>admin123</span>
              </div>
              <div class="font-mono">
                <span class="text-gold-light">mudur@rebirth.com</span>
                <span class="text-pearl-40 mx-2">·</span>
                <span>admin123</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p class="text-center text-[10px] uppercase tracking-extra-wide text-pearl-40 mt-8">
        © {{ new Date().getFullYear() }} Rebirth Software
      </p>
    </div>

    <!-- Alt altın çubuk -->
    <div class="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold-primary/50 to-transparent" />
  </div>
</template>
