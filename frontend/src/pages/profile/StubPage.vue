<template>
  <f7-page>
    <f7-page-content class="pb-10">
      <div class="flex items-center gap-3 px-5 pt-6 pb-4">
        <button type="button" class="sp-icon-btn" @click="f7router.back()">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">{{ title }}</h1>
      </div>
      <div class="sp-card mx-6 mt-4 p-8 text-center">
        <span class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full" style="background: var(--color-accent-soft); color: var(--color-accent)">
          <f7-icon :f7="icon" size="24" />
        </span>
        <p class="m-0 mb-1 font-semibold">{{ title }}</p>
        <p class="m-0 text-sm" style="color: var(--color-sub)">{{ text }}</p>
      </div>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import type { Router } from 'framework7/types'

withDefaults(defineProps<{ f7router: Router.Router; title?: string; text?: string; icon?: string }>(), {
  title: 'Раздел',
  text: 'Этот раздел скоро появится.',
  icon: 'sparkles',
})
</script>
