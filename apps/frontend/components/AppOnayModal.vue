<script setup lang="ts">
// Global onay modal — useOnay() composable'ı tarafından kontrol edilir.
// Layout'ta tek bir kez yerleştirilir, tüm sayfalar paylaşır.

const { sira, yanitla } = useOnay();

function onayla() {
  yanitla(true);
}
function iptal() {
  yanitla(false);
}

// Escape ile iptal, Enter ile onay
function tusBasildi(e: KeyboardEvent) {
  if (!sira.value) return;
  if (e.key === 'Escape') iptal();
  if (e.key === 'Enter') onayla();
}

if (import.meta.client) {
  window.addEventListener('keydown', tusBasildi);
}
onUnmounted(() => {
  if (import.meta.client) window.removeEventListener('keydown', tusBasildi);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200"
      leave-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="sira"
        class="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4"
        @click.self="iptal"
      >
        <Transition
          enter-active-class="transition duration-200 ease-luxe"
          leave-active-class="transition duration-150"
          enter-from-class="opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95"
          leave-to-class="opacity-0 translate-y-6 sm:translate-y-0 sm:scale-95"
        >
          <div
            v-if="sira"
            :class="[
              'surface-elevated max-w-sm w-full p-6 relative overflow-hidden rounded-t-3xl sm:rounded-3xl',
            ]"
          >
            <!-- Üst renkli çizgi -->
            <div
              :class="[
                'absolute top-0 left-1/4 right-1/4 h-px',
                sira.tehlikeli
                  ? 'bg-gradient-to-r from-transparent via-red-400/70 to-transparent'
                  : 'bg-gradient-to-r from-transparent via-gold-bright/70 to-transparent'
              ]"
            />
            <div class="flex items-start gap-4 mb-5">
              <div
                :class="[
                  'w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 relative',
                  sira.tehlikeli
                    ? 'bg-red-500/15 text-red-300 border border-red-500/40'
                    : 'bg-gold-soft text-gold-primary border border-gold-primary/40',
                ]"
              >
                <i :class="['fas', sira.tehlikeli ? 'fa-triangle-exclamation' : 'fa-circle-question']" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 v-if="sira.baslik" class="text-base font-semibold text-pearl mb-1">{{ sira.baslik }}</h3>
                <p class="text-sm text-pearl-80 leading-relaxed">{{ sira.mesaj }}</p>
              </div>
            </div>

            <div class="flex gap-3">
              <button
                type="button"
                @click="iptal"
                class="flex-1 py-2.5 px-4 rounded-xl bg-pearl-5 border border-pearl-20 text-pearl-80 hover:bg-pearl-10 hover:text-pearl transition text-sm font-medium"
              >
                {{ sira.iptalMetni || 'İptal' }}
              </button>
              <button
                type="button"
                @click="onayla"
                :class="[
                  'flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm transition',
                  sira.tehlikeli
                    ? 'bg-red-500/90 hover:bg-red-500 text-white shadow-[0_8px_24px_-8px_rgba(239,68,68,0.5)]'
                    : 'btn-gold !w-auto !py-2.5 !px-4',
                ]"
                autofocus
              >
                {{ sira.onayMetni || 'Onayla' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
