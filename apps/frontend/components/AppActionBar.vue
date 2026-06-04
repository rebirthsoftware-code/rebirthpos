<script setup lang="ts">
export interface AksiyonOge {
  ad: string;
  ikon: string;
  onClick?: () => void;
  disabled?: boolean;
  vurgu?: boolean;
  tehlike?: boolean;
}

defineProps<{
  ogeler: AksiyonOge[];
}>();
</script>

<template>
  <aside
    class="w-16 sm:w-20 md:w-24 shrink-0 bg-ink-200 border-r border-pearl-10
           flex flex-col py-2 sm:py-3 gap-0.5 sm:gap-1 self-stretch"
  >
    <button
      v-for="(o, i) in ogeler"
      :key="i"
      @click="o.onClick"
      :disabled="o.disabled"
      :class="[
        'action-btn !py-3 sm:!py-4 !px-1',
        o.tehlike && 'hover:!text-red-300 hover:!bg-red-500/15',
        o.vurgu && '!text-gold-primary',
      ]"
      :title="o.ad"
    >
      <i :class="['fas', o.ikon]" />
      <span class="!text-[10px] sm:!text-[11px] hidden sm:inline">{{ o.ad }}</span>
    </button>
  </aside>
</template>
