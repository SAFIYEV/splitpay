<template>
  <f7-page>
    <f7-page-content class="pb-10">
      <div class="flex items-center gap-3 px-5 pt-6 pb-4">
        <button type="button" class="sp-icon-btn" @click="go('/profile/')">
          <f7-icon f7="chevron_left" size="20" />
        </button>
        <h1 class="m-0 text-lg font-bold">Кошелёк</h1>
      </div>

      <!-- Connected -->
      <template v-if="wallet.isConnected && wallet.connected">
        <div class="px-6">
          <div class="sp-card flex flex-col items-center p-6 text-center">
            <img :src="wallet.connected.wallet.icon" :alt="wallet.connected.wallet.name" class="mb-3 h-16 w-16 rounded-2xl" />
            <p class="m-0 text-lg font-bold">{{ wallet.connected.wallet.name }}</p>
            <button
              type="button"
              class="m-0 mt-1 flex items-center gap-1 border-0 bg-transparent p-0 text-sm"
              style="color: var(--color-accent)"
              @click="copyAddress"
            >
              {{ truncateAddress(wallet.address ?? '', 8, 8) }}
              <f7-icon f7="doc_on_doc" size="13" />
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 px-6">
          <div class="sp-card-sm p-4">
            <p class="m-0 text-xs font-medium" style="color: var(--color-sub)">Баланс SOL</p>
            <p class="m-0 mt-1 text-lg font-bold">{{ wallet.solBalance?.toFixed(4) ?? '—' }}</p>
          </div>
          <div class="sp-card-sm p-4">
            <p class="m-0 text-xs font-medium" style="color: var(--color-sub)">Сеть</p>
            <p class="m-0 mt-1 text-lg font-bold">{{ network }}</p>
          </div>
        </div>

        <div class="mt-4 px-6">
          <div class="sp-card divide-y overflow-hidden">
            <button type="button" class="sp-row" @click="refreshBalance">
              <f7-icon f7="arrow_2_circlepath" size="17" style="color: var(--color-accent)" />
              <span>Обновить баланс</span>
            </button>
            <button v-if="network === 'devnet'" type="button" class="sp-row" @click="airdrop">
              <f7-icon f7="gift_fill" size="17" style="color: var(--color-mint)" />
              <span>Запросить devnet airdrop (1 SOL)</span>
            </button>
            <a
              class="sp-row no-underline"
              :href="`https://explorer.solana.com/address/${wallet.address}?cluster=${network}`"
              target="_blank"
              rel="noopener"
            >
              <f7-icon f7="globe" size="17" style="color: var(--color-sub)" />
              <span>Открыть в Solana Explorer</span>
            </a>
          </div>
        </div>

        <div class="mt-6 px-6">
          <button
            type="button"
            class="w-full rounded-[18px] border-0 py-4 text-[16px] font-semibold"
            style="background: #ffeef3; color: var(--color-rose)"
            @click="disconnect"
          >
            Отключить кошелёк
          </button>
        </div>
      </template>

      <!-- Not connected -->
      <template v-else>
        <div class="px-6">
          <p class="mt-0 mb-4 text-sm" style="color: var(--color-sub)">
            Подключите кошелёк Solana, чтобы входить без пароля и оплачивать долги в USDC on-chain.
          </p>

          <template v-if="wallet.wallets.length > 0">
            <button
              v-for="w in wallet.wallets"
              :key="w.name"
              type="button"
              class="sp-card-sm mb-3 flex w-full items-center gap-3 border-0 p-4 text-left"
              :disabled="wallet.connecting"
              @click="connect(w)"
            >
              <img :src="w.icon" :alt="w.name" class="h-11 w-11 rounded-xl" />
              <span class="min-w-0 flex-1">
                <span class="block font-semibold">{{ w.name }}</span>
                <span class="block text-xs" style="color: var(--color-sub)">{{ walletCapabilities(w) }}</span>
              </span>
              <f7-icon f7="chevron_right" size="16" style="color: var(--color-sub)" />
            </button>
          </template>

          <div v-else class="sp-card p-8 text-center">
            <p class="m-0 mb-1 font-semibold">Кошелёк не обнаружен</p>
            <p class="m-0 text-sm" style="color: var(--color-sub)">
              Установите Phantom, Solflare или Backpack — SplitPay найдёт их автоматически.
            </p>
            <p class="mt-4 mb-0 text-sm">
              <f7-link external href="https://phantom.com" target="_blank">Phantom</f7-link> ·
              <f7-link external href="https://solflare.com" target="_blank">Solflare</f7-link> ·
              <f7-link external href="https://backpack.app" target="_blank">Backpack</f7-link>
            </p>
          </div>
        </div>
      </template>

      <p v-if="wallet.error" class="mx-6 mt-3 text-center text-sm" style="color: var(--color-rose)">{{ wallet.error }}</p>
    </f7-page-content>
  </f7-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { f7 } from 'framework7-vue'
import { requestAirdrop, SOLANA_NETWORK } from '@/services/solana'
import { truncateAddress } from '@/services/utils/format'
import type { ConnectableWallet } from '@/services/wallet-adapter'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const network = SOLANA_NETWORK

function walletCapabilities(w: ConnectableWallet): string {
  const caps: string[] = []
  if (wallet.walletSupportsSignMessage(w)) caps.push('вход по подписи')
  if (wallet.walletSupportsSignTransaction(w)) caps.push('платежи')
  return caps.length > 0 ? caps.join(' · ') : 'Подключение'
}

function go(url: string) {
  f7.views.main.router.navigate(url)
}

async function connect(w: ConnectableWallet) {
  try {
    await wallet.connect(w)
    f7.toast.create({ text: `Подключён ${w.name}`, position: 'center', closeTimeout: 1500 }).open()
  } catch {
    // wallet.error is set by the store and shown below.
  }
}

async function disconnect() {
  await wallet.disconnect()
  f7.toast.create({ text: 'Кошелёк отключён', position: 'center', closeTimeout: 1500 }).open()
}

async function refreshBalance() {
  try {
    await wallet.refreshBalance()
  } catch (e) {
    f7.dialog.alert(e instanceof Error ? e.message : 'Ошибка RPC', 'Не удалось обновить баланс')
  }
}

async function airdrop() {
  if (!wallet.address) return
  try {
    await requestAirdrop(wallet.address, 1)
    f7.toast.create({ text: 'Airdrop запрошен — баланс обновится вскоре', position: 'center', closeTimeout: 2500 }).open()
    setTimeout(() => void wallet.refreshBalance().catch(() => {}), 5000)
  } catch (e) {
    f7.dialog.alert(e instanceof Error ? e.message : 'Ошибка RPC', 'Airdrop не удался')
  }
}

async function copyAddress() {
  if (!wallet.address) return
  try {
    await navigator.clipboard.writeText(wallet.address)
    f7.toast.create({ text: 'Адрес скопирован', position: 'center', closeTimeout: 1500 }).open()
  } catch {
    f7.dialog.alert(wallet.address, 'Адрес кошелька')
  }
}

onMounted(() => wallet.refreshWallets())
</script>

<style scoped>
.sp-row {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  border: 0;
  border-color: #f0eefb;
  background: transparent;
  padding: 16px;
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  color: var(--color-ink);
  cursor: pointer;
}
</style>
