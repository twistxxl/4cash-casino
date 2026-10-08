import type { RouletteSelection } from '@/shared/api';

/** Порядок чисел на европейском колесе по часовой стрелке, начиная с зеро */
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
] as const;

export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export type PocketColor = 'red' | 'black' | 'green';

export function pocketColor(n: number): PocketColor {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

/** Выплата «к одному» — как на сервере (libs/common/src/roulette.ts) */
export function payoutOdds(sel: RouletteSelection): number {
  if (sel.type === 'straight') return 35;
  if (sel.type === 'dozen') return 2;
  return 1;
}

export function sameSelection(a: RouletteSelection | null, b: RouletteSelection): boolean {
  if (!a || a.type !== b.type) return false;
  if (a.type === 'straight' && b.type === 'straight') return a.number === b.number;
  if (a.type === 'dozen' && b.type === 'dozen') return a.dozen === b.dozen;
  return true;
}

/** Строки стола: верхний ряд 3, 6, … 36; средний 2, 5, … 35; нижний 1, 4, … 34 */
export const BOARD_ROWS = [3, 2, 1].map((start) => Array.from({ length: 12 }, (_, i) => start + i * 3));
