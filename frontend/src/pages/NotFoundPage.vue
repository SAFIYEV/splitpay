<template>
  <f7-page>
    <f7-navbar title="Not found" back-link="Back" />
    <EmptyState
      icon="questionmark_circle"
      material-icon="help"
      title="Page not found"
      text="The page you are looking for does not exist."
    >
      <f7-button fill round href="/groups/">Go to groups</f7-button>
    </EmptyState>
  </f7-page>
</template>

<script setup lang="ts">
import EmptyState from '@/components/common/EmptyState.vue'
</script>
