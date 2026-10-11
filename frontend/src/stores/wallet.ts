import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getBase58Decoder } from '@solana/kit'
import {
  base64ToBytes,
  bytesToBase64,
  canSignMessage,
  canSignTransaction,
  connectWallet,
  disconnectWallet,
  listWallets,
  onWalletsChanged,
  signAuthMessage,
  signTransactionBytes,
  type ConnectedWallet,
  type ConnectableWallet,
} from '@/services/wallet-adapter'
import { getSolBalance } from '@/services/solana'

// Solana wallet state. Targets Phantom / Solflare / Backpack via Wallet Standard.
// On desktop browsers without an extension, `wallets` is simply empty and the
// UI degrades to a "no wallet detected" hint instead of breaking.

export const useWalletStore = defineStore('wallet', () => {
  const wallets = ref<ConnectableWallet[]>([])
  const connected = ref<ConnectedWallet | null>(null)
  const solBalance = ref<number | null>(null)
  const connecting = ref(false)
  const error = ref<string | null>(null)

  const address = computed(() => connected.value?.account.address ?? null)
  const isConnected = computed(() => connected.value !== null)
  const walletName = computed(() => connected.value?.wallet.name ?? null)

  let stopWatching: (() => void) | null = null

  function refreshWallets() {
    wallets.value = listWallets()
  }

  /** Start watching for wallet (extension) registration events. */
  function init() {
    refreshWallets()
    stopWatching ??= onWalletsChanged((found) => {
      wallets.value = found
    })
  }

  function dispose() {
    stopWatching?.()
    stopWatching = null
  }

  async function connect(wallet: ConnectableWallet) {
    connecting.value = true
    error.value = null
    try {
      connected.value = await connectWallet(wallet)
      await refreshBalance()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Wallet connection was rejected'
      throw e
    } finally {
      connecting.value = false
    }
  }

  async function disconnect() {
    if (connected.value) await disconnectWallet(connected.value.wallet)
    connected.value = null
    solBalance.value = null
  }

  async function refreshBalance() {
    if (!address.value) return
    solBalance.value = await getSolBalance(address.value)
  }

  function walletSupportsSignMessage(wallet: ConnectableWallet) {
    return canSignMessage(wallet)
  }

  function walletSupportsSignTransaction(wallet: ConnectableWallet) {
    return canSignTransaction(wallet)
  }

  /** Sign the auth challenge message; returns a base58 signature for the API
   *  (backend verifies with getBase58Encoder — base64 here is rejected with 401). */
  async function signMessage(message: string): Promise<string> {
    if (!connected.value) throw new Error('No wallet connected')
    const { signature } = await signAuthMessage(connected.value, message)
    return getBase58Decoder().decode(signature)
  }

  /** Sign a backend-prepared base64 transaction; returns base64 signed tx. */
  async function signTransaction(transactionBase64: string): Promise<string> {
    if (!connected.value) throw new Error('No wallet connected')
    const signed = await signTransactionBytes(connected.value, base64ToBytes(transactionBase64))
    return bytesToBase64(signed)
  }

  return {
    wallets,
    connected,
    solBalance,
    connecting,
    error,
    address,
    isConnected,
    walletName,
    init,
    dispose,
    refreshWallets,
    connect,
    disconnect,
    refreshBalance,
    walletSupportsSignMessage,
    walletSupportsSignTransaction,
    signMessage,
    signTransaction,
  }
})
