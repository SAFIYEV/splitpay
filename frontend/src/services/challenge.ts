// Client-side validation of the wallet-auth challenge before it is offered
// to the wallet for signing. A compromised backend must not be able to make
// the user sign arbitrary messages (e.g. a challenge of another service).

const MAX_AGE_MS = 5 * 60_000

/**
 * Throws unless `message` is a well-formed SplitPay auth challenge for
 * `walletAddress`, issued within the last 5 minutes.
 */
export function assertWalletChallenge(message: string, walletAddress: string): void {
  const lines = message.split('\n')
  const [title, walletLine, nonceLine, issuedLine] = lines
  if (
    lines.length !== 4 ||
    title !== 'SplitPay wallet authentication' ||
    walletLine !== `Wallet: ${walletAddress}` ||
    !/^Nonce: [0-9a-f]{32}$/.test(nonceLine ?? '') ||
    !issuedLine?.startsWith('Issued at: ')
  ) {
    throw new Error('Сервер вернул некорректный challenge — подпись отклонена')
  }
  const issuedAt = Date.parse(issuedLine.slice('Issued at: '.length))
  if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > MAX_AGE_MS) {
    throw new Error('Challenge устарел — запросите новый')
  }
}
