<template>
  <f7-page>
    <f7-navbar title="Profile" back-link="Groups" />

    <f7-block v-if="auth.user" class="my-4">
      <f7-card class="m-0">
        <f7-card-content class="flex items-center gap-4">
          <UserAvatar :name="auth.user.displayName" :src="auth.user.avatar" :size="56" />
          <div class="min-w-0">
            <p class="m-0 truncate text-lg font-bold">{{ auth.user.displayName }}</p>
            <p v-if="auth.user.email" class="m-0 truncate text-sm opacity-60">{{ auth.user.email }}</p>
            <p v-if="auth.user.walletAddress" class="m-0 text-sm opacity-60">
              <f7-icon f7="wallet_pass" material="account_balance_wallet" size="14" class="mr-1" />
              {{ truncateAddress(auth.user.walletAddress, 6, 6) }}
            </p>
          </div>
        </f7-card-content>
      </f7-card>
    </f7-block>

    <f7-list strong inset dividers>
      <f7-list-input
        v-model:value="displayName"
        label="Display name"
        type="text"
        clear-button
      />
    </f7-list>
    <f7-block v-if="nameDirty" class="my-2">
      <f7-button fill round :disabled="saving" preloader :loading="saving" @click="saveName">
        Save name
      </f7-button>
    </f7-block>

    <f7-list strong inset dividers>
      <f7-list-item link href="/profile/wallet/" title="Wallet">
        <template #media>
          <f7-icon f7="wallet_pass" material="account_balance_wallet" color="deeppurple" />
        </template>
        <template #after>
          <f7-badge :color="wallet.isConnected ? 'green' : 'gray'">
            {{ wallet.isConnected ? wallet.walletName : 'Not connected' }}
          </f7-badge>
        </template>
      </f7-list-item>
      <f7-list-item link href="/profile/notifications/" title="Notifications">
        <template #media>
          <f7-icon f7="bell_fill" material="notifications" color="orange" />
        </template>
        <template #after>
          <f7-badge v-if="notifications.unreadCount > 0" color="red">
            {{ notifications.unreadCount }}
          </f7-badge>
        </template>
      </f7-list-item>
      <f7-list-item link href="/activity/" title="Activity">
        <template #media>
          <f7-icon f7="bolt_fill" material="bolt" color="blue" />
        </template>
      </f7-list-item>
    </f7-list>

    <f7-block>
      <f7-button large outline round color="red" @click="confirmLogout">Sign out</f7-button>
    </f7-block>

    <f7-block class="text-center text-xs opacity-40">
      SplitPay · {{ network }} · USDC settlements on Solana
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { f7 } from 'framework7-vue'
import UserAvatar from '@/components/common/UserAvatar.vue'
import { apiErrorMessage } from '@/services/api'
import { SOLANA_NETWORK } from '@/services/solana'
import { truncateAddress } from '@/services/utils/format'
import { disconnectWebSocket } from '@/services/websocket'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { useWalletStore } from '@/stores/wallet'

const auth = useAuthStore()
const wallet = useWalletStore()
const notifications = useNotificationsStore()

const network = SOLANA_NETWORK
const displayName = ref('')
const saving = ref(false)

const nameDirty = computed(
  () => displayName.value.trim().length >= 2 && displayName.value !== auth.user?.displayName,
)

watch(
  () => auth.user?.displayName,
  (value) => {
    displayName.value = value ?? ''
  },
  { immediate: true },
)

async function saveName() {
  saving.value = true
  try {
    await auth.updateProfile({ displayName: displayName.value.trim() })
    f7.toast.create({ text: 'Profile updated', position: 'center', closeTimeout: 1500 }).open()
  } catch (e) {
    f7.dialog.alert(apiErrorMessage(e), 'Could not update profile')
  } finally {
    saving.value = false
  }
}

function confirmLogout() {
  f7.dialog.confirm('Sign out of SplitPay?', 'Sign out', async () => {
    disconnectWebSocket()
    await wallet.disconnect().catch(() => {})
    auth.logout()
    f7.views.main.router.navigate('/login/', { clearPreviousHistory: true })
  })
}

onMounted(() => {
  // Self-heal if the boot-time fetchMe failed (e.g. backend restarting).
  if (!auth.user) void auth.fetchMe().catch(() => {})
  void notifications.fetchNotifications().catch(() => {})
})
</script>
