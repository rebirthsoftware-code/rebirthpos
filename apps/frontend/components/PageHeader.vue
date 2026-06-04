<script setup lang="ts">
defineProps<{
  baslik: string;
  aciklama?: string;
  ikon?: string;
}>();
</script>

<template>
  <header class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
    <div class="flex items-start gap-4">
      <div v-if="ikon" class="icon-tile-gold mt-1">
        <i :class="['fas', ikon]" />
      </div>
      <div>
        <p v-if="aciklama" class="text-[11px] uppercase tracking-extra-wide text-pearl-50 font-semibold mb-1">
          {{ aciklama }}
        </p>
        <h1 class="text-2xl md:text-3xl font-light text-pearl tracking-tight">{{ baslik }}</h1>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
