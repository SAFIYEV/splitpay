import {
  address,
  createSolanaRpc,
  lamports,
  signature as toSignature,
  type Address,
  type Signature,
} from '@solana/kit'

// Thin RPC helpers on top of @solana/kit. The heavy lifting for settlement
// transactions happens on the backend (prepare-tx → client signs → send);
// this module covers balance lookups, devnet airdrop and raw tx submission.

export const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC ?? 'https://api.mainnet-beta.solana.com'
export const SOLANA_NETWORK = import.meta.env.VITE_SOLANA_NETWORK ?? 'mainnet-beta'

/** USDC mint addresses (6 decimals both networks). */
export const USDC_MINT: Record<string, string> = {
  'mainnet-beta': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  devnet: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
}

export const LAMPORTS_PER_SOL = 1_000_000_000

type SolanaRpc = ReturnType<typeof createSolanaRpc>

let rpc: SolanaRpc | null = null

export function getRpc(): SolanaRpc {
  rpc ??= createSolanaRpc(SOLANA_RPC_URL)
  return rpc
}

export function toAddress(value: string): Address {
  return address(value)
}

/** SOL balance in whole SOL units. */
export async function getSolBalance(addr: string): Promise<number> {
  const { value } = await getRpc().getBalance(toAddress(addr)).send()
  return Number(value) / LAMPORTS_PER_SOL
}

/** USDC balance in whole USDC units: sums every token account of `addr` for the
 *  current network's USDC mint. 0 when the wallet has no USDC token account yet. */
export async function getUsdcBalance(addr: string): Promise<number> {
  const mint = USDC_MINT[SOLANA_NETWORK]
  if (!mint) throw new Error(`No USDC mint configured for network "${SOLANA_NETWORK}"`)
  const { value } = await getRpc()
    .getTokenAccountsByOwner(toAddress(addr), { mint: toAddress(mint) }, { encoding: 'jsonParsed' })
    .send()
  let total = 0
  for (const { account } of value) {
    total += account.data.parsed.info.tokenAmount.uiAmount ?? 0
  }
  return total
}

/** Base fee per transaction signature — a Solana protocol constant. */
const BASE_FEE_LAMPORTS_PER_SIGNATURE = 5_000
/** Assumed compute units for a plain SPL token transfer without a setComputeUnitLimit ix. */
const DEFAULT_COMPUTE_UNITS = 200_000

/**
 * Rough network-fee estimate for a 1-signature USDC transfer, in SOL:
 * the protocol base fee plus the median prioritization fee observed in recent
 * blocks (per-CU price × default CU budget). Falls back to the base fee when
 * the RPC has no recent fee data.
 */
export async function estimateTransferFeeSol(): Promise<number> {
  let priorityMicroLamportsPerCu = 0
  try {
    const fees = await getRpc().getRecentPrioritizationFees().send()
    const sorted = fees.map((f) => Number(f.prioritizationFee)).sort((a, b) => a - b)
    if (sorted.length > 0) priorityMicroLamportsPerCu = sorted[Math.floor(sorted.length / 2)]!
  } catch {
    // No fee data — base fee alone is still a valid floor estimate.
  }
  const lamports =
    BASE_FEE_LAMPORTS_PER_SIGNATURE + (priorityMicroLamportsPerCu * DEFAULT_COMPUTE_UNITS) / 1e6
  return lamports / LAMPORTS_PER_SOL
}

/** Devnet-only helper: request an airdrop of `sol` SOL. */
export async function requestAirdrop(addr: string, sol: number): Promise<Signature> {
  if (SOLANA_NETWORK !== 'devnet') {
    throw new Error('Airdrop is only available on devnet')
  }
  // requestAirdrop exists only on devnet/testnet RPC typings; narrow locally.
  const rpc = getRpc() as unknown as {
    requestAirdrop(
      addr: Address,
      amount: ReturnType<typeof lamports>,
      config?: object,
    ): { send(): Promise<Signature> }
  }
  return rpc
    .requestAirdrop(toAddress(addr), lamports(BigInt(Math.round(sol * LAMPORTS_PER_SOL))))
    .send()
}

/** Submit a fully-signed transaction encoded as base64. Returns the tx signature. */
export async function sendBase64Transaction(transactionBase64: string): Promise<Signature> {
  return getRpc()
    .sendTransaction(transactionBase64 as Parameters<SolanaRpc['sendTransaction']>[0], {
      encoding: 'base64',
      skipPreflight: false,
    })
    .send()
}

export interface SignatureStatus {
  signature: string
  confirmed: boolean
  failed: boolean
}

/** Check confirmation status of a submitted transaction. */
export async function getSignatureStatus(sig: string): Promise<SignatureStatus> {
  const { value } = await getRpc().getSignatureStatuses([toSignature(sig)]).send()
  const status = value[0]
  const confirmed =
    !!status && (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized')
  return { signature: sig, confirmed, failed: !!status?.err }
}

/** Poll until a signature confirms or the timeout elapses. */
export async function waitForConfirmation(sig: string, timeoutMs = 60_000): Promise<SignatureStatus> {
  const started = Date.now()
  for (;;) {
    const status = await getSignatureStatus(sig)
    if (status.confirmed || status.failed) return status
    if (Date.now() - started > timeoutMs) throw new Error('Transaction confirmation timed out')
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
}
