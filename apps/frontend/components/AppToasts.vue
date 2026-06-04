<script setup lang="ts">
const toast = useToastStore();

const tipMeta = {
  basari: { ikon: 'fa-circle-check', renk: 'emerald', accent: 'rgba(52,211,153,0.9)' },
  hata: { ikon: 'fa-circle-exclamation', renk: 'red', accent: 'rgba(248,113,113,0.9)' },
  uyari: { ikon: 'fa-triangle-exclamation', renk: 'amber', accent: 'rgba(251,191,36,0.9)' },
  bilgi: { ikon: 'fa-circle-info', renk: 'blue', accent: 'rgba(96,165,250,0.9)' },
} as const;
</script>

<template>
  <Teleport to="body">
    <div class="fixed top-4 right-4 left-4 sm:left-auto z-[60] flex flex-col gap-2 pointer-events-none w-auto sm:w-full sm:max-w-sm">
      <TransitionGroup
        enter-active-class="transition duration-300 ease-luxe"
        leave-active-class="transition duration-200"
        move-class="transition duration-300"
        enter-from-class="opacity-0 translate-x-8 scale-95"
        leave-to-class="opacity-0 translate-x-8 scale-95"
      >
        <div
          v-for="t in toast.listesi"
          :key="t.id"
          class="toast-card flex items-start gap-3"
        >
          <!-- Sol renkli çizgi + ışıltı -->
          <span
            class="absolute left-0 top-0 bottom-0 w-1"
            :style="{ background: `linear-gradient(180deg, transparent, ${tipMeta[t.tip].accent}, transparent)` }"
          />

          <!-- İkon arka plan halkası -->
          <div
            :class="[
              'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border',
              t.tip === 'basari' && 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
              t.tip === 'hata' && 'bg-red-500/15 border-red-500/40 text-red-300',
              t.tip === 'uyari' && 'bg-amber-500/15 border-amber-500/40 text-amber-300',
              t.tip === 'bilgi' && 'bg-blue-500/15 border-blue-500/40 text-blue-300',
            ]"
          >
            <i :class="['fas', tipMeta[t.tip].ikon, 'text-base']" />
          </div>

          <div class="flex-1 min-w-0 pr-2">
            <div v-if="t.baslik" class="font-semibold text-sm text-pearl mb-0.5">{{ t.baslik }}</div>
            <div class="text-sm text-pearl-80 leading-snug break-words">{{ t.mesaj }}</div>
          </div>

          <button
            @click="toast.kapat(t.id)"
            class="text-pearl-50 hover:text-pearl transition shrink-0 w-7 h-7 -mt-1 -mr-1 rounded-lg hover:bg-pearl-10 flex items-center justify-center"
            aria-label="Kapat"
          >
            <i class="fas fa-times text-xs" />
          </button>

          <!-- Alt progress bar -->
          <div
            class="absolute bottom-0 left-0 h-[2px] toast-progress"
            :style="{ color: tipMeta[t.tip].accent }"
          />
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-progress {
  width: 100%;
  background: linear-gradient(to right, transparent, currentColor, transparent);
  animation: progress 4s linear forwards;
}
@keyframes progress {
  from { transform: translateX(-100%); }
  to { transform: translateX(100%); }
}
</style>
