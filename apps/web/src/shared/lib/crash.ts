import { CRASH_GROWTH } from '@/shared/config';

/** Множитель через t мс полёта — та же формула, что на сервере: m(t) = e^(GROWTH * t) */
export function multiplierAt(elapsedMs: number): number {
  return Math.floor(Math.exp(CRASH_GROWTH * Math.max(0, elapsedMs)) * 100) / 100;
}

/** Обратная функция: сколько мс прошло, если множитель уже m (для подключения посреди раунда) */
export function elapsedFor(multiplier: number): number {
  return Math.log(Math.max(1, multiplier)) / CRASH_GROWTH;
}

export function formatMultiplier(m: number): string {
  return `${m.toFixed(2)}×`;
}
