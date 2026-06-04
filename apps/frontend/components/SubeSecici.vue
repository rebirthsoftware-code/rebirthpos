<script setup lang="ts">
import { onClickOutside } from '@vueuse/core';

const sube = useSubeStore();
const acik = ref(false);
const root = ref<HTMLElement | null>(null);
onClickOutside(root, () => (acik.value = false));

onMounted(async () => {
  sube.yukleAktifSube();
  if (!sube.subeler.length) await sube.yukle();
});

function sec(id: string) {
  sube.aktifSec(id);
  acik.value = false;
}

const ozet = computed(() => sube.aktifSube);
</script>

<template>
  <div v-if="sube.subeler.length > 1" ref="root" class="relative">
    <button
      @click="acik = !acik"
      class="flex items-center gap-3 bg-pearl-5 border border-pearl-20 rounded-xl px-4 py-2.5 text-sm hover:bg-pearl-10 hover:border-pearl-30 transition"
    >
      <i class="fas fa-store text-gold-primary text-xs" />
      <span class="font-medium text-pearl">{{ ozet?.ad || 'Şube Seç' }}</span>
      <i :class="['fas fa-chevron-down text-[10px] text-pearl-50 transition-transform', acik && 'rotate-180']" />
    </button>

    <Transition
      enter-active-class="transition duration-150"
      leave-active-class="transition duration-100"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="acik"
        class="absolute right-0 mt-2 w-72 surface-elevated p-2 z-50 max-h-96 overflow-y-auto"
      >
        <div class="text-[10px] uppercase tracking-extra-wide text-pearl-50 px-3 py-2 font-semibold">
          Şube Seç
        </div>
        <button
          v-for="s in sube.subeler"
          :key="s.id"
          @click="sec(s.id)"
          :class="[
            'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition',
            s.id === sube.aktifSubeId
              ? 'bg-gold-soft text-gold-primary'
              : 'hover:bg-pearl-5 text-pearl-80',
          ]"
        >
          <i class="fas fa-store w-4 text-center text-xs" />
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ s.ad }}</div>
            <div v-if="s.firma" class="text-[10px] text-pearl-50 truncate">{{ s.firma.ad }}</div>
          </div>
          <i v-if="s.id === sube.aktifSubeId" class="fas fa-check text-gold-primary text-xs" />
        </button>
      </div>
    </Transition>
  </div>

  <div v-else-if="sube.subeler.length === 1" class="flex items-center gap-2 text-sm text-pearl-70">
    <i class="fas fa-store text-gold-primary text-xs" />
    {{ sube.subeler[0].ad }}
  </div>
</template>
