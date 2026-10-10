import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, map } from 'rxjs';

/**
 * Recursively converts Prisma Decimal instances to JS numbers so JSON
 * responses carry `"amount": 50` instead of `"amount": "50.000000"`.
 * Dates, class instances, null/undefined and primitives pass through.
 */
export function serializeDecimals(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (value instanceof Prisma.Decimal) {
    return value.toNumber();
  }
  if (value instanceof Date) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(serializeDecimals);
  }
  if (typeof value === 'object') {
    const proto: unknown = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value; // leave class instances (Buffer, etc.) untouched
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = serializeDecimals(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class DecimalSerializerInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(map((data) => serializeDecimals(data)));
  }
}
