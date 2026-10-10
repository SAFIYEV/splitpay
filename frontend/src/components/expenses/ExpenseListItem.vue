<template>
  <f7-list-item
    swipeout
    :link="`/groups/${groupId}/expenses/${expense.id}/`"
    :title="expense.description"
    :after="formatUsdc(expense.amount)"
    :subtitle="`${payerName} paid · ${formatDate(expense.date)}`"
  >
    <template #media>
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full"
        :style="{ backgroundColor: `${meta.color}22`, color: meta.color }"
      >
        <f7-icon :f7="meta.f7Icon" :material="meta.materialIcon" size="22" />
      </div>
    </template>
    <f7-swipeout-actions right>
      <f7-swipeout-button color="blue" @click="$emit('edit', expense)">Edit</f7-swipeout-button>
      <f7-swipeout-button delete color="red" @click="$emit('delete', expense)">
        Delete
      </f7-swipeout-button>
    </f7-swipeout-actions>
  </f7-list-item>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Expense } from '@/types'
import { categoryMeta } from '@/composables/categories'
import { formatDate, formatUsdc } from '@/services/utils/format'

const props = defineProps<{
  expense: Expense
  groupId: string
  memberName: (userId: string) => string
}>()

defineEmits<{ edit: [expense: Expense]; delete: [expense: Expense] }>()

const meta = computed(() => categoryMeta(props.expense.category))
const payerName = computed(() => props.memberName(props.expense.paidBy))
</script>
