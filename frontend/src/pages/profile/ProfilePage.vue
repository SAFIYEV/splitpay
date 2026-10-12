<template>
  <f7-page>
    <f7-page-content class="pb-32">
      <!-- Header -->
      <div class="flex items-center justify-between px-6 pt-8 pb-2">
        <h1 class="m-0 text-2xl font-bold">Профиль</h1>
        <button type="button" class="sp-icon-btn" @click="go('/profile/about/')">
          <f7-icon f7="gear_alt" size="19" />
        </button>
      </div>

      <!-- Identity -->
      <div class="mt-4 flex flex-col items-center px-6 text-center">
        <div class="rounded-full p-1.5" style="background: var(--color-accent-soft)">
          <UserAvatar :name="auth.user?.displayName ?? '?'" :src="auth.user?.avatar" :size="96" />
        </div>
        <button type="button" class="mt-3 border-0 bg-transparent p-0 text-xl font-bold" @click="editName">
          {{ auth.user?.displayName ?? '…' }}
        </button>
        <p class="m-0 text-sm" style="color: var(--color-sub)">@{{ handle }}</p>
      </div>

      <!-- Wallet card -->
      <div class="mt-6 px-6">
        <button type="button" class="sp-card flex w-full items-center gap-3 border-0 p-5 text-left" @click="go('/profile/wallet/')">
          <div class="min-w-0 flex-1">
            <p class="m-0 text-[13px] font-medium" style="color: var(--color-sub)">Кошелёк</p>
            <template v-if="wallet.isConnected">
              <p class="m-0 mt-1 text-xl font-bold">{{ wallet.solBalance?.toFixed(4) ?? '—' }} SOL</p>
              <p class="m-0 text-xs" style="color: var(--color-sub)">
                {{ truncateAddress(wallet.address ?? '', 6, 6) }} · Solana
              </p>
            </template>
            <p v-else class="m-0 mt-1 text-[15px] font-semibold" style="color: var(--color-accent)">
              Подключить кошелёк
            </p>
          </div>
          <span
            class="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-bold text-white"
            style="background: linear-gradient(135deg, #9945ff, #14f195)"
          >◎</span>
        </button>
      </div>

      <!-- Menu -->
      <div class="mt-5 px-6">
        <div class="sp-card divide-y overflow-hidden" style="--tw-divide-opacity: 1">
          <button
            v-for="row in menu"
            :key="row.label"
            type="button"
            class="flex w-full items-center gap-3 border-0 bg-transparent p-4 text-left"
            style="border-color: #f0eefb"
            @click="go(row.url)"
          >
            <span class="flex h-9 w-9 items-center justify-center rounded-xl" style="background: var(--color-accent-soft); color: var(--color-accent)">
              <f7-icon :f7="row.icon" size="17" />
            </span>
            <span class="flex-1 text-[15px] font-semibold">{{ row.label }}</span>
            <f7-badge v-if="row.label === 'Уведомления' && notifications.unreadCount > 0" color="red">
              {{ notifications.unreadCount }}
            </f7-badge>
            <f7-icon f7="chevron_right" size="14" style="color: var(--color-sub)" />
          </button>
        </div>
      </div>

      <!-- Logout -->
      <div class="mt-6 px-6">
        <button
          type="button"
          class="w-full rounded-[18px] border-0 py-4 text-[16px] font-semibold"
          style="background: #ffeef3; color: var(--color-rose)"
          @click="confirmLogout"
        >
          Выйти
        </button>
      </div>
    </f7-page-content>

    <TabBar active="profile" />
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import TabBar from '@/components/layout/TabBar.vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { truncateAddress } from '@/services/utils/format'
import { disconnectWebSocket } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useWalletStore } from '@/stores/wallet'

const auth = useAuthStore()
const wallet = useWalletStore()
const notifications = useNotificationsStore()

const handle = computed(() => {
  const email = auth.user?.email
  if (email) return email.split('@')[0]
  return auth.user?.walletAddress ? truncateAddress(auth.user.walletAddress, 4, 4).toLowerCase() : 'user'
})

const menu = [
  { label: 'Уведомления', icon: 'bell', url: '/profile/notifications/' },
  { label: 'Безопасность', icon: 'shield_check', url: '/profile/security/' },
  { label: 'Помощь и поддержка', icon: 'questionmark_circle', url: '/profile/help/' },
  { label: 'О приложении', icon: 'info_circle', url: '/profile/about/' },
]

function go(url: string) {
  f7.views.main.router.navigate(url)
}

function editName() {
  // prompt(message, title, callbackOk, callbackCancel, defaultValue)
  f7.dialog.prompt(
    'Ваше имя:',
    'Изменить имя',
    async (value) => {
      const name = value.trim()
      if (name.length < 2) return
      try {
        await auth.updateProfile({ displayName: name })
        f7.toast.create({ text: 'Имя обновлено', position: 'center', closeTimeout: 1500 }).open()
      } catch (e) {
        f7.dialog.alert(apiErrorMessage(e), 'Не удалось обновить имя')
      }
    },
    undefined,
    auth.user?.displayName ?? '',
  )
}

function confirmLogout() {
  f7.dialog.confirm('Выйти из SplitPay?', 'Выход', async () => {
    disconnectWebSocket()
    await wallet.disconnect().catch(() => {})
    auth.logout()
    f7.views.main.router.navigate('/login/', { clearPreviousHistory: true })
  })
}

onMounted(() => {
  if (!auth.user) void auth.fetchMe().catch(() => {})
  void notifications.fetchNotifications().catch(() => {})
  if (wallet.isConnected) void wallet.refreshBalance().catch(() => {})
})
</script>
