// Formatting helpers: USDC amounts (6 on-chain decimals), dates, addresses.

/** Format a USDC amount given in whole-USDC units (e.g. 12.5). */
export function formatUsdc(amount: number, withSymbol = true): string {
  const abs = Math.abs(amount)
  // Show up to 6 decimals, but trim trailing zeros; at least 2 decimals for readability.
  const raw = abs.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  const [, decimals = ''] = raw.split('.')
  const digits = decimals.length < 2 ? 2 : decimals.length
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  const signed = amount < 0 ? `-${formatted}` : formatted
  return withSymbol ? `${signed} USDC` : signed
}

/** Convert whole-USDC units to on-chain base units (6 decimals) as bigint. */
export function usdcToBaseUnits(amount: number): bigint {
  return BigInt(Math.round(amount * 1_000_000))
}

/** Convert on-chain base units back to whole-USDC units. */
export function baseUnitsToUsdc(baseUnits: bigint | number | string): number {
  return Number(baseUnits) / 1_000_000
}

export function formatDate(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** "just now", "5m ago", "2h ago", "3d ago", then falls back to a short date. */
export function formatRelativeTime(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

/** Truncate a Solana address: "9WzD…3xYf". */
export function truncateAddress(addr: string, head = 4, tail = 4): string {
  if (addr.length <= head + tail + 1) return addr
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

/** "12 мая" */
export function formatDateRu(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })
}

/** "11 мая 2025 г." */
export function formatDateLongRu(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** "11 мая, 14:30" */
export function formatDateTimeRu(iso: string | Date): string {
  const date = typeof iso === 'string' ? new Date(iso) : iso
  return `${formatDateRu(date)}, ${date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
}

/** Extract the first emoji found in a group name (design uses emoji as group icons). */
export function groupEmoji(name: string): string {
  const match = name.match(
    /(\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*)/u,
  )
  return match?.[1] ?? ''
}

/** Group name with emoji stripped (emoji is rendered separately as the icon). */
export function groupNameWithoutEmoji(name: string): string {
  return name
    .replace(/\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic})*/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
