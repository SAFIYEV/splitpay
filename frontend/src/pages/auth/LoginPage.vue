<template>
  <f7-page>
    <f7-navbar title="Sign in" />

    <f7-block class="mb-2 flex flex-col items-center text-center">
      <div class="mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-brand-500 shadow-lg">
        <f7-icon f7="creditcard_fill" material="payments" size="40" color="white" />
      </div>
      <h1 class="m-0 text-2xl font-bold">SplitPay</h1>
      <p class="mt-1 mb-0 opacity-60">Split expenses. Settle in USDC on Solana.</p>
    </f7-block>

    <f7-list strong inset dividers form @submit.prevent>
      <f7-list-input
        v-model:value="email"
        label="Email"
        type="email"
        placeholder="you@example.com"
        autocomplete="email"
        clear-button
      />
      <f7-list-input
        v-model:value="password"
        label="Password"
        type="password"
        placeholder="Your password"
        autocomplete="current-password"
        clear-button
      />
    </f7-list>

    <f7-block class="mt-4">
      <f7-button large fill round preloader :loading="auth.loading" :disabled="!canSubmit" @click="submit">
        Sign in
      </f7-button>
      <p v-if="errorText" class="mt-3 mb-0 text-center text-sm text-red-500">{{ errorText }}</p>
      <p class="mt-4 mb-0 text-center text-sm opacity-70">
        New to SplitPay?
        <f7-link href="/register/" class="font-semibold">Create an account</f7-link>
      </p>
    </f7-block>

    <f7-block-title>Or continue with a wallet</f7-block-title>
    <f7-list v-if="wallet.wallets.length > 0" strong inset>
      <f7-list-item
        v-for="w in wallet.wallets"
        :key="w.name"
        link
        :title="w.name"
        :disabled="wallet.connecting"
        @click="connectWith(w)"
      >
        <template #media>
          <img :src="w.icon" :alt="w.name" class="h-8 w-8 rounded-lg" />
        </template>
      </f7-list-item>
    </f7-list>
    <f7-block v-else class="mt-2 text-sm opacity-60">
      No Solana wallet detected. Install Phantom, Solflare or Backpack to sign in with a wallet —
      or use email above.
    </f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { f7 } from 'framework7-vue'
import { apiErrorMessage } from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useWalletStore } from '@/stores/wallet'
import type { ConnectableWallet } from '@/services/wallet-adapter'

const auth = useAuthStore()
const wallet = useWalletStore()

const email = ref('')
const password = ref('')
const errorText = ref<string | null>(null)

const canSubmit = computed(() => email.value.includes('@') && password.value.length > 0)

onMounted(() => wallet.refreshWallets())

async function submit() {
  errorText.value = null
  try {
    await auth.login(email.value.trim(), password.value)
    f7.views.main.router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    errorText.value = apiErrorMessage(e)
  }
}

/** Wallet auth flow: connect → challenge → sign → verify (spec 8.1). */
async function connectWith(w: ConnectableWallet) {
  errorText.value = null
  try {
    await wallet.connect(w)
    const address = wallet.address
    if (!address) throw new Error('Wallet did not return an address')
    const { message } = await auth.walletChallenge(address)
    const signature = await wallet.signMessage(message)
    await auth.walletVerify(address, signature)
    f7.views.main.router.navigate('/groups/', { clearPreviousHistory: true })
  } catch (e) {
    errorText.value = apiErrorMessage(e)
    await wallet.disconnect().catch(() => {})
  }
}
</script>
