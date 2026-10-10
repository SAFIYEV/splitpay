<template>
  <f7-page>
    <f7-navbar title="Wallet" back-link="Profile" />

    <!-- Connected state -->
    <template v-if="wallet.isConnected && wallet.connected">
      <f7-block class="my-4">
        <f7-card class="m-0">
          <f7-card-content class="flex flex-col items-center py-6 text-center">
            <img
              :src="wallet.connected.wallet.icon"
              :alt="wallet.connected.wallet.name"
              class="mb-3 h-16 w-16 rounded-2xl"
            />
            <p class="m-0 text-lg font-bold">{{ wallet.connected.wallet.name }}</p>
            <button
              type="button"
              class="m-0 mt-1 flex items-center gap-1 border-0 bg-transparent p-0 text-sm text-brand-500"
              @click="copyAddress"
            >
              {{ truncateAddress(wallet.address ?? '', 8, 8) }}
              <f7-icon f7="doc_on_doc" material="content_copy" size="14" />
            </button>
          </f7-card-content>
        </f7-card>
      </f7-block>

      <f7-block class="my-2 grid grid-cols-2 gap-3">
        <f7-card class="sp-stat-card m-0">
          <f7-card-content>
            <p class="m-0 text-xs uppercase tracking-wide opacity-60">SOL balance</p>
            <p class="mt-1 mb-0 text-xl font-bold">{{ wallet.solBalance?.toFixed(4) ?? '—' }}</p>
          </f7-card-content>
        </f7-card>
        <f7-card class="sp-stat-card m-0">
          <f7-card-content>
            <p class="m-0 text-xs uppercase tracking-wide opacity-60">Network</p>
            <p class="mt-1 mb-0 text-xl font-bold">{{ network }}</p>
          </f7-card-content>
        </f7-card>
      </f7-block>

      <f7-list strong inset dividers>
        <f7-list-item link title="Refresh balance" @click="refreshBalance">
          <template #media>
            <f7-icon f7="arrow_2_circlepath" material="refresh" color="blue" />
          </template>
        </f7-list-item>
        <f7-list-item
          v-if="network === 'devnet'"
          link
          title="Request devnet airdrop (1 SOL)"
          @click="airdrop"
        >
          <template #media>
            <f7-icon f7="gift_fill" material="redeem" color="green" />
          </template>
        </f7-list-item>
        <f7-list-item
          link
          title="View on Solana Explorer"
          external
          :href="`https://explorer.solana.com/address/${wallet.address}?cluster=${network}`"
          target="_blank"
        >
          <template #media>
            <f7-icon f7="globe" material="public" color="gray" />
          </template>
        </f7-list-item>
      </f7-list>

      <f7-block>
        <f7-button large outline round color="red" @click="disconnect">Disconnect wallet</f7-button>
      </f7-block>
    </template>

    <!-- Not connected -->
    <template v-else>
      <f7-block class="mb-2">
        <p class="m-0 opacity-70">
          Connect a Solana wallet to sign in, pay settlements in USDC and verify payments on-chain.
        </p>
      </f7-block>

      <f7-list v-if="wallet.wallets.length > 0" strong inset dividers>
        <f7-list-item
          v-for="w in wallet.wallets"
          :key="w.name"
          link
          :title="w.name"
          :subtitle="walletCapabilities(w)"
          :disabled="wallet.connecting"
          @click="connect(w)"
        >
          <template #media>
            <img :src="w.icon" :alt="w.name" class="h-10 w-10 rounded-xl" />
          </template>
        </f7-list-item>
      </f7-list>

      <EmptyState
        v-else
        icon="wallet_pass"
        material-icon="account_balance_wallet"
        title="No wallet detected"
        text="Install Phantom, Solflare or Backpack, then come back — SplitPay detects them automatically."
      />

      <f7-block class="my-2 text-sm opacity-60">
        <p class="mt-0">Recommended wallets:</p>
        <p class="mb-0">
          <f7-link external href="https://phantom.com" target="_blank">Phantom</f7-link> ·
          <f7-link external href="https://solflare.com" target="_blank">Solflare</f7-link> ·
          <f7-link external href="https://backpack.app" target="_blank">Backpack</f7-link>
        </p>
      </f7-block>
    </template>

    <f7-block v-if="wallet.error" class="my-2 text-sm text-red-500">{{ wallet.error }}</f7-block>
  </f7-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { requestAirdrop, SOLANA_NETWORK } from '@/services/solana'
import { truncateAddress } from '@/services/utils/format'
import type { ConnectableWallet } from '@/services/wallet-adapter'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const network = SOLANA_NETWORK

function walletCapabilities(w: ConnectableWallet): string {
  const caps: string[] = []
  if (wallet.walletSupportsSignMessage(w)) caps.push('sign-in')
  if (wallet.walletSupportsSignTransaction(w)) caps.push('payments')
  return caps.length > 0 ? `Supports ${caps.join(' & ')}` : 'Connect'
}

async function connect(w: ConnectableWallet) {
  try {
    await wallet.connect(w)
    f7.toast.create({ text: `Connected ${w.name}`, position: 'center', closeTimeout: 1500 }).open()
  } catch {
    // wallet.error is set by the store and shown below.
  }
}

async function disconnect() {
  await wallet.disconnect()
  f7.toast.create({ text: 'Wallet disconnected', position: 'center', closeTimeout: 1500 }).open()
}

async function refreshBalance() {
  try {
    await wallet.refreshBalance()
  } catch (e) {
    f7.dialog.alert(e instanceof Error ? e.message : 'RPC error', 'Could not refresh balance')
  }
}

async function airdrop() {
  if (!wallet.address) return
  try {
    await requestAirdrop(wallet.address, 1)
    f7.toast.create({ text: 'Airdrop requested — balance updates shortly', position: 'center', closeTimeout: 2500 }).open()
    setTimeout(() => void wallet.refreshBalance().catch(() => {}), 5000)
  } catch (e) {
    f7.dialog.alert(e instanceof Error ? e.message : 'RPC error', 'Airdrop failed')
  }
}

async function copyAddress() {
  if (!wallet.address) return
  try {
    await navigator.clipboard.writeText(wallet.address)
    f7.toast.create({ text: 'Address copied', position: 'center', closeTimeout: 1500 }).open()
  } catch {
    f7.dialog.alert(wallet.address, 'Wallet address')
  }
}

onMounted(() => wallet.refreshWallets())
</script>
