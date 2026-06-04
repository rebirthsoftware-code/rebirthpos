<script setup lang="ts">
const props = defineProps<{
  acik: boolean;
  baslik?: string;
  genislik?: string; // tailwind class, ör: 'max-w-xl'
}>();
const emit = defineEmits<{ kapat: [] }>();

function kapat() {
  emit('kapat');
}

watch(
  () => props.acik,
  (a) => {
    if (import.meta.client) {
      document.body.style.overflow = a ? 'hidden' : '';
    }
  },
);

onUnmounted(() => {
  if (import.meta.client) document.body.style.overflow = '';
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
        v-if="acik"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex sm:items-center justify-center items-end sm:p-4"
        @click.self="kapat"
      >
        <Transition
          enter-active-class="transition duration-200"
          leave-active-class="transition duration-150"
          enter-from-class="opacity-0 sm:scale-95 translate-y-4 sm:translate-y-0"
          leave-to-class="opacity-0 sm:scale-95 translate-y-4 sm:translate-y-0"
        >
          <div
            v-if="acik"
            class="surface-elevated w-full p-5 sm:p-8 relative max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl"
            :class="genislik || 'max-w-xl'"
          >
            <div v-if="baslik" class="flex items-center justify-between mb-5 sm:mb-6 pb-4 border-b border-pearl-10 sticky top-0 -mt-5 -mx-5 sm:-mt-8 sm:-mx-8 px-5 pt-5 sm:px-8 sm:pt-8 bg-white/95 backdrop-blur-sm z-10">
              <h3 class="text-base sm:text-lg font-semibold text-pearl tracking-tight">{{ baslik }}</h3>
              <button
                @click="kapat"
                class="w-9 h-9 rounded-lg bg-pearl-5 hover:bg-pearl-10 text-pearl-60 hover:text-pearl transition flex items-center justify-center shrink-0"
                aria-label="Kapat"
              >
                <i class="fas fa-times" />
              </button>
            </div>
            <slot />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
