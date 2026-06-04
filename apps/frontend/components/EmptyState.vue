<script setup lang="ts">
defineProps<{
  ikon?: string;
  baslik: string;
  aciklama?: string;
}>();
</script>

<template>
  <div class="glass-card p-12 text-center">
    <div v-if="ikon" class="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gold-soft border border-gold-primary/30 flex items-center justify-center text-2xl text-gold-primary">
      <i :class="['fas', ikon]" />
    </div>
    <div class="text-base font-semibold text-pearl mb-1">{{ baslik }}</div>
    <p v-if="aciklama" class="text-sm text-pearl-60 mb-6 max-w-sm mx-auto">{{ aciklama }}</p>
    <slot />
  </div>
</template>
