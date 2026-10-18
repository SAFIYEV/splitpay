// Dev-only mock Wallet Standard wallet for testing the wallet auth/connect
// flow without a browser extension. Registered only when explicitly enabled
// (see main.ts: dev mode + ?mockwallet query param).
import {
  generateKeyPair,
  getAddressEncoder,
  getAddressFromPublicKey,
  signBytes,
} from '@solana/kit'
import type { Wallet, WalletAccount } from '@wallet-standard/base'
import { registerWallet } from '@wallet-standard/wallet'

const ICON = ('data:image/svg+xml;base64,' +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#7c3aed"/><text x="16" y="22" font-size="16" text-anchor="middle" fill="white" font-family="Arial">M</text></svg>',
  )) as Wallet['icon']

export async function registerMockWallet(): Promise<void> {
  const keypair = await generateKeyPair()
  const address = await getAddressFromPublicKey(keypair.publicKey)
  const publicKey = new Uint8Array(getAddressEncoder().encode(address))

  const account: WalletAccount = {
    address,
    publicKey,
    chains: ['solana:mainnet'],
    features: ['standard:connect', 'standard:signMessage'],
    label: 'Dev Mock Account',
  }

  // accounts is readonly on the Wallet interface; the mock mutates it on connect.
  const accounts: WalletAccount[] = []

  const wallet: Wallet = {
    version: '1.0.0',
    name: 'DevMock Wallet',
    icon: ICON,
    chains: ['solana:mainnet'],
    accounts,
    features: {
      'standard:connect': {
        version: '1.0.0',
        connect: async () => {
          accounts.length = 0
          accounts.push(account)
          return { accounts: [...accounts] }
        },
      },
      'standard:disconnect': {
        version: '1.0.0',
        disconnect: async () => {
          accounts.length = 0
        },
      },
      'standard:signMessage': {
        version: '1.1.0',
        signMessage: async ({ message }: { message: Uint8Array }) => {
          const signature = await signBytes(keypair.privateKey, message)
          return { signedMessage: message, signature }
        },
      },
    } as Wallet['features'],
  }

  registerWallet(wallet)
}
