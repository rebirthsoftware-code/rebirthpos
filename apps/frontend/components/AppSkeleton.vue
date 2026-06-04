<script setup lang="ts">
defineProps<{
  // 'kart' (kart grid), 'liste', 'sayfa' (KPI + içerik)
  tip?: 'kart' | 'liste' | 'sayfa';
  // kaç tane
  adet?: number;
}>();
</script>

<template>
  <div v-if="tip === 'sayfa'" class="space-y-5 sm:space-y-6">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
      <div v-for="i in 4" :key="i" class="glass-card p-5">
        <div class="skeleton-bar h-3 w-1/2 mb-3" />
        <div class="skeleton-bar h-8 w-3/4" />
        <div class="skeleton-bar h-2 w-1/3 mt-3 opacity-60" />
      </div>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      <div v-for="i in 2" :key="i" class="glass-card p-5">
        <div class="skeleton-bar h-4 w-1/3 mb-4" />
        <div class="space-y-2.5">
          <div v-for="j in 4" :key="j" class="flex justify-between">
            <div class="skeleton-bar h-3 w-1/2" />
            <div class="skeleton-bar h-3 w-1/4" />
          </div>
        </div>
      </div>
    </div>
  </div>

  <div v-else-if="tip === 'liste'" class="space-y-2">
    <div v-for="i in adet || 6" :key="i" class="glass-card p-4 flex items-center gap-3">
      <div class="skeleton-bar w-10 h-10 rounded-xl shrink-0" />
      <div class="flex-1 space-y-2">
        <div class="skeleton-bar h-3 w-1/2" />
        <div class="skeleton-bar h-2.5 w-1/3 opacity-60" />
      </div>
      <div class="skeleton-bar h-4 w-20 shrink-0" />
    </div>
  </div>

  <div v-else class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
    <div v-for="i in adet || 8" :key="i" class="glass-card p-5">
      <div class="skeleton-bar w-12 h-12 rounded-2xl mb-3" />
      <div class="skeleton-bar h-4 w-3/4 mb-2" />
      <div class="skeleton-bar h-3 w-1/2 opacity-60" />
    </div>
  </div>
</template>
