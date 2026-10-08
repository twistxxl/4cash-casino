import { BadRequestException, GatewayTimeoutException, NotFoundException } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout, TimeoutError } from 'rxjs';

/** Синхронный запрос через брокер с таймаутом + перевод RPC-ошибок в HTTP-коды */
export async function rpc<T = any>(client: ClientProxy, pattern: string, data: unknown, ms = 5_000): Promise<T> {
  try {
    return await firstValueFrom(client.send<T>(pattern, data).pipe(timeout(ms)));
  } catch (e: any) {
    if (e instanceof TimeoutError) {
      throw new GatewayTimeoutException(`${pattern}: нет ответа за ${ms} мс — сервис запущен?`);
    }
    const message: string = typeof e === 'string' ? e : (e?.message ?? JSON.stringify(e));
    if (message.includes('NOT_FOUND')) throw new NotFoundException(message);
    throw new BadRequestException(message);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) throw new BadRequestException(`${field}: нужен UUID`);
  return value;
}

export function assertAmount(value: unknown, max = 1_000_000): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0 || n > max) throw new BadRequestException(`amount: целое число 1..${max}`);
  return n;
}
