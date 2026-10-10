<template>
  <f7-block class="flex flex-col items-center justify-center py-12 text-center">
    <f7-icon :f7="icon" :material="materialIcon" size="56" class="mb-4 opacity-30" />
    <p class="m-0 text-lg font-semibold">{{ title }}</p>
    <p v-if="text" class="mx-0 mt-1 mb-4 max-w-60 opacity-60">{{ text }}</p>
    <slot />
  </f7-block>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{ icon: string; materialIcon: string; title: string; text?: string }>(),
  { text: '' },
)
</script>
