<template>
  <f7-page ptr @ptr:refresh="refresh">
    <f7-page-content class="pb-28">
      <!-- Header -->
      <div class="flex items-center justify-between px-5 pt-6 pb-2">
        <button type="button" class="sp-icon-btn" @click="go('/groups/')">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">
          {{ group ? groupNameWithoutEmoji(group.name) : '…' }}
          <span v-if="group && groupEmoji(group.name)">{{ groupEmoji(group.name) }}</span>
        </h1>
        <button type="button" class="sp-icon-btn" @click="go(`/groups/${groupId}/settings/`)">
          <f7-icon f7="gear_alt" size="19" />
        </button>
      </div>

      <template v-if="group">
        <!-- Members row -->
        <div class="mt-2 flex justify-center gap-4 px-6">
          <div
            v-for="member in sortedMembers"
            :key="member.userId"
            class="flex w-14 flex-col items-center gap-1"
          >
            <UserAvatar :name="displayName(member.userId)" :size="48" />
            <span class="max-w-full truncate text-xs" style="color: var(--color-sub)">
              {{ member.userId === auth.user?.id ? 'Вы' : displayName(member.userId) }}
            </span>
          </div>
        </div>

        <!-- Balance card -->
        <div class="mt-4 px-6">
          <div class="sp-card p-5">
            <p class="m-0 text-[13px] font-medium" style="color: var(--color-sub)">Баланс группы</p>
            <p class="sp-positive m-0 mt-1 text-[28px] leading-8 font-bold">
              {{ formatUsdc(group.totalSpent) }}
            </p>
            <button type="button" class="sp-btn-soft mt-4" @click="go(`/groups/${groupId}/balances/`)">
              Посмотреть расчёты
            </button>
          </div>
        </div>

        <!-- Recent expenses -->
        <div class="mt-6 px-6">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="m-0 text-[17px] font-bold">Недавние расходы</h3>
            <button
              type="button"
              class="flex h-8 w-8 items-center justify-center rounded-full border-0"
              style="background: var(--color-accent-soft); color: var(--color-accent)"
              @click="go(`/groups/${groupId}/expenses/new/`)"
            >
              <f7-icon f7="plus" size="16" />
            </button>
          </div>

          <template v-if="recentExpenses.length > 0">
            <button
              v-for="expense in recentExpenses"
              :key="expense.id"
              type="button"
              class="sp-card-sm mb-3 flex w-full items-center gap-3 border-0 p-4 text-left"
              @click="go(`/groups/${groupId}/expenses/${expense.id}/`)"
            >
              <span
                class="flex h-11 w-11 items-center justify-center rounded-2xl"
                :style="{ backgroundColor: `${categoryMeta(expense.category).color}1a`, color: categoryMeta(expense.category).color }"
              >
                <f7-icon :f7="categoryMeta(expense.category).f7Icon" size="20" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold">{{ expense.description }}</span>
                <span class="block text-xs" style="color: var(--color-sub)">{{ displayName(expense.paidBy) }}</span>
              </span>
              <span class="text-right">
                <span class="sp-positive block text-[15px] font-bold">{{ formatUsdc(expense.amount) }}</span>
                <span class="block text-xs" style="color: var(--color-sub)">{{ formatDateRu(expense.date) }}</span>
              </span>
            </button>
            <button
              v-if="expensesStore.expensesFor(groupId).length > recentExpenses.length"
              type="button"
              class="sp-btn-soft"
              @click="go(`/groups/${groupId}/expenses/`)"
            >
              Все расходы
            </button>
          </template>

          <div v-else class="sp-card p-8 text-center">
            <p class="m-0 mb-1 font-semibold">Пока нет расходов</p>
            <p class="m-0 text-sm" style="color: var(--color-sub)">Нажмите +, чтобы добавить первый расход.</p>
          </div>
        </div>
      </template>

      <div v-else class="flex justify-center py-20">
        <f7-preloader />
      </div>
    </f7-page-content>

    <!-- Bottom segmented: Обзор / Расчёты -->
    <div class="absolute right-0 bottom-0 left-0 z-30 px-16 pb-6">
      <div class="flex rounded-full p-1" style="background: #eceaf7">
        <button type="button" class="sp-seg-btn flex-1 rounded-full bg-white py-2.5 text-sm font-semibold" style="color: var(--color-accent); box-shadow: 0 4px 12px rgba(109,91,226,0.12)">
          Обзор
        </button>
        <button type="button" class="sp-seg-btn flex-1 rounded-full py-2.5 text-sm font-semibold" style="color: var(--color-sub)" @click="go(`/groups/${groupId}/balances/`)">
          Расчёты
        </button>
      </div>
    </div>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { categoryMeta } from '@/composables/categories'
import { formatDateRu, formatUsdc, groupEmoji, groupNameWithoutEmoji } from '@/services/utils/format'
import { joinGroupRoom, leaveGroupRoom } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'
import { useExpensesStore } from '@/stores/expenses'
import { useGroupsStore } from '@/stores/groups'
import type { Group, GroupMember } from '@/types'

const props = defineProps<{ f7route: { params: { id: string } } }>()

const groupsStore = useGroupsStore()
const expensesStore = useExpensesStore()
const auth = useAuthStore()

const groupId = props.f7route.params.id
const group = ref<Group | null>(groupsStore.currentGroup?.id === groupId ? groupsStore.currentGroup : null)

/** Current user first, then the rest. */
const sortedMembers = computed<GroupMember[]>(() => {
  if (!group.value) return []
  const me = group.value.members.filter((m) => m.userId === auth.user?.id)
  const rest = group.value.members.filter((m) => m.userId !== auth.user?.id)
  return [...me, ...rest]
})

const recentExpenses = computed(() =>
  [...expensesStore.expensesFor(groupId)]
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .slice(0, 5),
)

function displayName(userId: string) {
  return groupsStore.memberName(group.value, userId)
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

async function load() {
  const fetched = await groupsStore.fetchGroup(groupId)
  group.value = fetched
  await expensesStore.fetchExpenses(groupId).catch(() => {})
}

async function refresh(done: () => void) {
  try {
    await load()
  } finally {
    done()
  }
}

onMounted(() => {
  void load().catch(() => {})
  joinGroupRoom(groupId)
})

onBeforeUnmount(() => leaveGroupRoom(groupId))
</script>
