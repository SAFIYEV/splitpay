import {
  AccountRole,
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getTransactionDecoder,
} from '@solana/kit'
import { base64ToBytes } from './wallet-adapter'
import { SOLANA_NETWORK, USDC_MINT } from './solana'

// Verifies backend-prepared transactions BEFORE the wallet signs them.
// The UI shows the user the settlement record (amount, recipient); a
// compromised backend could serve a transaction doing something else
// entirely (drain accounts, delegate authority). The wallet prompt is the
// last line of defense — this module is the one before it.

const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
const TRANSFER_CHECKED_DISCRIMINATOR = 12
const TRANSFER_CHECKED_DATA_LEN = 10
const USDC_DECIMALS = 6

export interface PreparedTransferExpectation {
  /** Amount in micro-USDC (6 decimals) from the settlement record. */
  amountMicro: bigint
  /** The connected wallet paying the settlement. */
  fromWallet: string
  /** ATAs exactly as returned by the prepare-tx endpoint. */
  fromTokenAccount: string
  toTokenAccount: string
}

/** Decimal-safe USDC → micro-USDC conversion (avoids float drift). */
export function toMicroUsdc(amount: number): bigint {
  return BigInt(amount.toFixed(USDC_DECIMALS).replace('.', ''))
}

function isSignerRole(role: AccountRole): boolean {
  return role === AccountRole.READONLY_SIGNER || role === AccountRole.WRITABLE_SIGNER
}

function fail(reason: string): never {
  throw new Error(`Транзакция не прошла проверку: ${reason}. Подпись отклонена.`)
}

/**
 * Verifies that `transactionBase64` does exactly one thing: an SPL
 * `transferChecked` of `amountMicro` USDC from the payer's ATA to the
 * recipient's ATA, authorized by the connected wallet. Throws otherwise.
 */
export function verifyPreparedTransfer(
  transactionBase64: string,
  expected: PreparedTransferExpectation,
): void {
  const expectedMint = USDC_MINT[SOLANA_NETWORK]
  if (!expectedMint) {
    fail(`неизвестный USDC mint для сети "${SOLANA_NETWORK}"`)
  }

  let message: ReturnType<typeof decompileTransactionMessage>
  try {
    const transaction = getTransactionDecoder().decode(base64ToBytes(transactionBase64))
    const compiled = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes)
    const lookups = (compiled as { addressTableLookups?: unknown[] }).addressTableLookups
    if ((lookups?.length ?? 0) > 0) {
      fail('используются address lookup tables')
    }
    message = decompileTransactionMessage(compiled as Parameters<typeof decompileTransactionMessage>[0])
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Транзакция не прошла')) throw error
    fail('не удалось разобрать транзакцию')
  }

  const feePayer =
    typeof message.feePayer === 'string' ? message.feePayer : message.feePayer?.address
  if (feePayer !== expected.fromWallet) {
    fail('комиссию платит не ваш кошелёк')
  }

  let transferFound = false
  for (const ix of message.instructions) {
    for (const account of ix.accounts ?? []) {
      if (isSignerRole(account.role) && account.address !== expected.fromWallet) {
        fail('транзакция требует подписи постороннего аккаунта')
      }
    }
    if (ix.programAddress !== TOKEN_PROGRAM) continue

    const data = ix.data ?? new Uint8Array(0)
    if (
      data.length !== TRANSFER_CHECKED_DATA_LEN ||
      data[0] !== TRANSFER_CHECKED_DISCRIMINATOR
    ) {
      fail('обнаружена посторонняя token-инструкция (не transferChecked)')
    }
    const [from, mint, to, authority] = (ix.accounts ?? []).map((a) => a.address)
    const amount = new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(1, true)
    const decimals = data[9]

    if (mint !== expectedMint) fail('токен не USDC (другой mint)')
    if (from !== expected.fromTokenAccount) fail('счёт отправителя не совпадает')
    if (to !== expected.toTokenAccount) fail('счёт получателя не совпадает')
    if (authority !== expected.fromWallet) fail('перевод авторизован не вашим кошельком')
    if (amount !== expected.amountMicro) fail('сумма не совпадает с расчётом')
    if (decimals !== USDC_DECIMALS) fail('некорректные decimals токена')
    if (transferFound) fail('обнаружено несколько переводов')
    transferFound = true
  }

  if (!transferFound) {
    fail('в транзакции нет ожидаемого USDC-перевода')
  }
}
