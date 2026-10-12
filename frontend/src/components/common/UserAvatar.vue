<template>
  <div
    class="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.38)}px`,
      backgroundColor: bg,
      color: fg,
    }"
  >
    <img v-if="src" :src="src" :alt="name" class="h-full w-full object-cover" />
    <span v-else>{{ initials(name) }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { initials } from '@/services/utils/format'

const props = withDefaults(defineProps<{ name: string; src?: string; size?: number }>(), {
  src: undefined,
  size: 40,
})

// Deterministic pastel palette per name
const PALETTE: [string, string][] = [
  ['#e8e4ff', '#6d5be2'],
  ['#dff5ea', '#1f9d62'],
  ['#ffe9f0', '#d23c68'],
  ['#fff3dd', '#c07f1a'],
  ['#e0f1ff', '#2f7fc4'],
  ['#f3e8ff', '#8b4fc9'],
]

const idx = computed(() => {
  let hash = 0
  for (const ch of props.name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0
  return hash % PALETTE.length
})
const bg = computed(() => PALETTE[idx.value]![0])
const fg = computed(() => PALETTE[idx.value]![1])
</script>
