<template>
  <div
    class="flex items-center justify-center rounded-full bg-brand-500 font-semibold text-white shrink-0 overflow-hidden"
    :style="{ width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.4)}px` }"
  >
    <img v-if="src" :src="src" :alt="name" class="h-full w-full object-cover" />
    <span v-else>{{ initials(name) }}</span>
  </div>
</template>

<script setup lang="ts">
import { initials } from '@/services/utils/format'

withDefaults(defineProps<{ name: string; src?: string; size?: number }>(), {
  src: undefined,
  size: 40,
})
</script>
