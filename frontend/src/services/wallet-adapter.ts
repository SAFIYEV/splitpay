import { getWallets } from '@wallet-standard/app'
import type { Wallet, WalletAccount, WalletWithFeatures } from '@wallet-standard/base'
import type { StandardConnectFeature, StandardDisconnectFeature } from '@wallet-standard/features'

// Wallet Standard integration. Target wallets: Phantom, Solflare, Backpack
// (all register themselves via the Wallet Standard on window).

/** standard:signMessage feature (structural — the installed @wallet-standard/features has no type for it). */
export interface StandardSignMessageFeature {
  'standard:signMessage': {
    version: string
    signMessage(input: {
      account: WalletAccount
      message: Uint8Array
    }): Promise<{ signedMessage: Uint8Array; signature: Uint8Array }>
  }
}

/** solana:signTransaction feature (structural — avoids an extra dependency). */
export interface SolanaSignTransactionFeature {
  'solana:signTransaction': {
    version: string
    supportedTransactionVersions: readonly unknown[]
    signTransaction(input: {
      account: WalletAccount
      transaction: Uint8Array
    }): Promise<{ signedTransaction: Uint8Array }>
  }
}

export type ConnectableWallet = WalletWithFeatures<
  StandardConnectFeature &
    Partial<StandardDisconnectFeature & StandardSignMessageFeature & SolanaSignTransactionFeature>
>

export interface ConnectedWallet {
  wallet: ConnectableWallet
  account: WalletAccount
}

/** All installed wallets that support the Solana chain and standard:connect. */
export function listWallets(): ConnectableWallet[] {
  return getWallets()
    .get()
    .filter(
      (w): w is ConnectableWallet =>
        'standard:connect' in w.features && w.chains.some((c) => c.startsWith('solana:')),
    )
}

/** Watch for wallets registering/unregistering (extensions load async). */
export function onWalletsChanged(callback: (wallets: ConnectableWallet[]) => void): () => void {
  const walletsApi = getWallets()
  const emit = () => callback(listWallets())
  const offRegister = walletsApi.on('register', emit)
  const offUnregister = walletsApi.on('unregister', emit)
  return () => {
    offRegister()
    offUnregister()
  }
}

export async function connectWallet(
  wallet: ConnectableWallet,
  silent = false,
): Promise<ConnectedWallet> {
  const { accounts } = await wallet.features['standard:connect'].connect({ silent })
  const account = accounts.find((a) => a.chains.some((c) => c.startsWith('solana:')))
  if (!account) throw new Error(`${wallet.name} did not return a Solana account`)
  return { wallet, account }
}

export async function disconnectWallet(wallet: Wallet): Promise<void> {
  const feature = wallet.features['standard:disconnect'] as
    | StandardDisconnectFeature['standard:disconnect']
    | undefined
  await feature?.disconnect()
}

export function canSignMessage(wallet: Wallet): boolean {
  return 'standard:signMessage' in wallet.features
}

/** Sign an arbitrary message — used for wallet-based auth (challenge → sign → verify). */
export async function signAuthMessage(
  connected: ConnectedWallet,
  message: string,
): Promise<{ signature: Uint8Array; signedMessage: Uint8Array }> {
  const feature = connected.wallet.features['standard:signMessage'] as
    | StandardSignMessageFeature['standard:signMessage']
    | undefined
  if (!feature) throw new Error(`${connected.wallet.name} cannot sign messages`)

  const { signature, signedMessage } = await feature.signMessage({
    account: connected.account,
    message: new TextEncoder().encode(message),
  })
  return { signature: new Uint8Array(signature), signedMessage: new Uint8Array(signedMessage) }
}

export function canSignTransaction(wallet: Wallet): boolean {
  return 'solana:signTransaction' in wallet.features
}

/** Sign a backend-prepared transaction (spec 5.2, payment flow step 3). */
export async function signTransactionBytes(
  connected: ConnectedWallet,
  transaction: Uint8Array,
): Promise<Uint8Array> {
  const feature = connected.wallet.features['solana:signTransaction'] as
    | SolanaSignTransactionFeature['solana:signTransaction']
    | undefined
  if (!feature) throw new Error(`${connected.wallet.name} cannot sign Solana transactions`)

  const { signedTransaction } = await feature.signTransaction({
    account: connected.account,
    transaction,
  })
  return new Uint8Array(signedTransaction)
}

/** base64 helpers for passing signatures/transactions to the API. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
