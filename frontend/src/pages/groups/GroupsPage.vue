<template>
  <f7-page ptr @ptr:refresh="refresh" @page:afterin="onAfterIn">
    <f7-page-content class="pb-32">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-8 pb-4">
        <h1 class="m-0 text-2xl font-bold" style="color: var(--color-accent)">SplitPay</h1>
        <button type="button" class="sp-icon-btn relative" @click="go('/profile/notifications/')">
          <f7-icon f7="bell" size="19" />
          <span
            v-if="notifications.unreadCount > 0"
            class="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full border-2 border-white"
            style="background: var(--color-rose)"
          />
        </button>
      </div>

      <!-- Active group card -->
      <div v-if="featuredGroup" class="px-6">
        <div class="sp-card mb-3 p-5">
          <div class="mb-1 flex items-center gap-2">
            <span class="text-2xl">{{ groupEmoji(featuredGroup.name) || '🌴' }}</span>
            <h2 class="m-0 text-lg font-bold">{{ groupNameWithoutEmoji(featuredGroup.name) }}</h2>
          </div>
          <p class="m-0 text-sm" style="color: var(--color-sub)">{{ featuredGroup.members.length }} участников</p>
        </div>

        <div class="sp-card p-5">
          <p class="m-0 text-[13px] font-medium" style="color: var(--color-sub)">Баланс группы</p>
          <p class="sp-positive m-0 mt-1 text-[28px] leading-8 font-bold">
            {{ formatUsdc(featuredGroup.totalSpent) }}
          </p>

          <div class="mt-4 flex gap-3">
            <div class="flex-1">
              <p class="m-0 text-[11px] font-semibold tracking-wide uppercase" style="color: var(--color-sub)">Вы должны</p>
              <p class="sp-negative m-0 mt-0.5 text-[15px] font-bold">{{ formatUsdc(myDebt) }}</p>
            </div>
            <div class="flex-1">
              <p class="m-0 text-[11px] font-semibold tracking-wide uppercase" style="color: var(--color-sub)">Вам должны</p>
              <p class="sp-positive m-0 mt-0.5 text-[15px] font-bold">{{ formatUsdc(myCredit) }}</p>
            </div>
          </div>

          <div class="mt-4 flex items-center">
            <div class="flex -space-x-2.5">
              <UserAvatar
                v-for="member in featuredGroup.members.slice(0, 5)"
                :key="member.userId"
                :name="featuredName(member.userId)"
                :size="34"
                class="ring-2 ring-white"
              />
            </div>
            <button
              type="button"
              class="ml-2 flex h-8.5 w-8.5 items-center justify-center rounded-full border-0"
              style="background: var(--color-accent-soft); color: var(--color-accent)"
              @click="go(`/groups/${featuredGroup.id}/members/`)"
            >
              <f7-icon f7="plus" size="16" />
            </button>
          </div>
        </div>
      </div>

      <!-- Groups list -->
      <div class="mt-6 px-6">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="m-0 text-[17px] font-bold">Группы</h3>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center rounded-full border-0"
            style="background: var(--color-accent-soft); color: var(--color-accent)"
            @click="go('/groups/new/')"
          >
            <f7-icon f7="plus" size="16" />
          </button>
        </div>

        <template v-if="groupsStore.activeGroups.length > 0">
          <button
            v-for="group in groupsStore.activeGroups"
            :key="group.id"
            type="button"
            class="sp-card-sm mb-3 flex w-full items-center gap-3 border-0 p-4 text-left"
            @click="go(`/groups/${group.id}/`)"
          >
            <span
              class="flex h-11 w-11 items-center justify-center rounded-2xl text-xl"
              style="background: var(--color-accent-soft)"
            >
              {{ groupEmoji(group.name) || '🌴' }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ groupNameWithoutEmoji(group.name) }}</span>
              <span class="block text-xs" style="color: var(--color-sub)">{{ group.members.length }} участников</span>
            </span>
            <span
              class="text-[15px] font-bold"
              :class="netFor(group.id) < 0 ? 'sp-negative' : 'sp-positive'"
            >
              {{ netFor(group.id) < 0 ? '−' : '' }}{{ formatUsdc(Math.abs(netFor(group.id))) }}
            </span>
          </button>
        </template>

        <div v-else class="sp-card p-8 text-center">
          <p class="m-0 mb-1 text-lg font-semibold">Пока нет групп</p>
          <p class="m-0 mb-5 text-sm" style="color: var(--color-sub)">
            Создайте группу для поездки, квартиры или команды.
          </p>
          <button type="button" class="sp-btn-gradient" @click="go('/groups/new/')">Создать первую группу</button>
          <button type="button" class="sp-btn-soft mt-3" @click="joinByCode">Вступить по коду</button>
        </div>
      </div>
    </f7-page-content>

    <TabBar active="home" :group-id="featuredGroup?.id ?? ''" />
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import TabBar from '@/components/layout/TabBar.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { formatUsdc, groupEmoji, groupNameWithoutEmoji } from '@/services/utils/format'
import { useAuthStore } from '@/stores/auth'
import { useGroupsStore } from '@/stores/groups'
import { useNotificationsStore } from '@/stores/notifications'
import { useSettlementsStore } from '@/stores/settlements'
import type { Group } from '@/types'

const groupsStore = useGroupsStore()
const notifications = useNotificationsStore()
const settlementsStore = useSettlementsStore()
const auth = useAuthStore()

const featuredGroup = computed<Group | null>(() => groupsStore.activeGroups[0] ?? null)

/** Current user's net balance per group: positive = is owed. */
function netFor(groupId: string): number {
  const balance = settlementsStore.balanceByGroup[groupId]
  return balance?.balances.find((b) => b.userId === auth.user?.id)?.amount ?? 0
}

const myDebt = computed(() => {
  const net = featuredGroup.value ? netFor(featuredGroup.value.id) : 0
  return net < 0 ? Math.abs(net) : 0
})
const myCredit = computed(() => {
  const net = featuredGroup.value ? netFor(featuredGroup.value.id) : 0
  return net > 0 ? net : 0
})

function featuredName(userId: string) {
  return groupsStore.memberName(featuredGroup.value, userId)
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

function joinByCode() {
  f7.dialog.prompt('Введите код приглашения:', 'Вступить в группу', async (code) => {
    if (!code.trim()) return
    try {
      const group = await groupsStore.joinByCode(code.trim())
      f7.toast.create({ text: `Вы вступили в «${group.name}»`, position: 'center', closeTimeout: 2000 }).open()
      go(`/groups/${group.id}/`)
    } catch (e) {
      f7.dialog.alert(apiErrorMessage(e), 'Не удалось вступить')
    }
  })
}

async function load() {
  await groupsStore.fetchGroups()
  await Promise.allSettled([
    notifications.fetchNotifications(),
    ...groupsStore.activeGroups.map((g) => settlementsStore.fetchBalance(g.id)),
  ])
}

async function refresh(done: () => void) {
  try {
    await load()
  } finally {
    done()
  }
}

// page:afterin also fires on the initial mount — skip that one (onMounted
// already loads), reload only when returning to this kept-alive page.
let firstAfterIn = true
function onAfterIn() {
  if (firstAfterIn) {
    firstAfterIn = false
    return
  }
  void load().catch(() => {})
}

onMounted(() => {
  void load().catch(() => {})
})
</script>
