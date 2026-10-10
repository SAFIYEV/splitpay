import { Prisma } from '@prisma/client';

/** USDC has 6 decimals; all integer math is done in micro-units (1 USDC = 1_000_000). */
export const MICRO_UNITS = 1_000_000n;

export function toMicroUnits(amount: number | string | Prisma.Decimal): bigint {
  const decimal = new Prisma.Decimal(amount);
  return BigInt(decimal.mul(MICRO_UNITS.toString()).toFixed(0));
}

export function fromMicroUnits(micro: bigint): string {
  const negative = micro < 0n;
  const abs = negative ? -micro : micro;
  const whole = abs / MICRO_UNITS;
  const fraction = (abs % MICRO_UNITS).toString().padStart(6, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

export function toDecimal(micro: bigint): Prisma.Decimal {
  return new Prisma.Decimal(fromMicroUnits(micro));
}
