<template>
  <f7-list-item :after="formatUsdc(debt.amount)">
    <template #title>
      <div class="flex items-center gap-2">
        <UserAvatar :name="fromName" :size="28" />
        <span class="font-medium">{{ fromName }}</span>
        <f7-icon f7="arrow_right" material="arrow_forward" size="16" class="opacity-50" />
        <UserAvatar :name="toName" :size="28" />
        <span class="font-medium">{{ toName }}</span>
      </div>
    </template>
    <template #inner-end>
      <slot name="action" />
    </template>
  </f7-list-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import type { SuggestedDebt } from '@/types'
import { formatUsdc } from '@/services/utils/format'

const props = defineProps<{
  debt: SuggestedDebt
  memberName: (userId: string) => string
}>()

const fromName = computed(() => props.debt.fromUser?.displayName ?? props.memberName(props.debt.fromUserId))
const toName = computed(() => props.debt.toUser?.displayName ?? props.memberName(props.debt.toUserId))
</script>
