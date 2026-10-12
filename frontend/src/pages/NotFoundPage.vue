<template>
  <f7-page>
    <f7-page-content class="flex flex-col items-center justify-center px-8 text-center">
      <span class="mb-4 flex h-16 w-16 items-center justify-center rounded-full" style="background: var(--color-accent-soft); color: var(--color-accent)">
        <f7-icon f7="questionmark_circle" size="30" />
      </span>
      <h1 class="m-0 mb-1 text-xl font-bold">Страница не найдена</h1>
      <p class="m-0 mb-6 text-sm" style="color: var(--color-sub)">Такой страницы не существует.</p>
      <button type="button" class="sp-btn-gradient" @click="go('/groups/')">На главную</button>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { f7 } from 'framework7-vue'

function go(url: string) {
  f7.views.main.router.navigate(url)
}
</script>
