import type { RouletteSelection } from './events';

// Европейская рулетка: 0..36, один зелёный ноль. RTP = 36/37 ≈ 97.3%
export const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function rouletteColor(n: number): 'green' | 'red' | 'black' {
  if (n === 0) return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

/** Выплата "к одному" (без учёта возвращаемой ставки) */
export function rouletteOdds(sel: RouletteSelection): number {
  if (sel.type === 'straight') return 35;
  if (sel.type === 'dozen') return 2;
  return 1;
}

export function rouletteWins(sel: RouletteSelection, n: number): boolean {
  if (sel.type === 'straight') return sel.number === n;
  if (n === 0) return false; // на зеро проигрывают все внешние ставки — в этом преимущество казино
  switch (sel.type) {
    case 'dozen':
      return Math.ceil(n / 12) === sel.dozen;
    case 'red':
      return RED_NUMBERS.has(n);
    case 'black':
      return !RED_NUMBERS.has(n);
    case 'even':
      return n % 2 === 0;
    case 'odd':
      return n % 2 === 1;
    case 'low':
      return n <= 18;
    case 'high':
      return n >= 19;
  }
}

/** Возвращает текст ошибки или null, если ставка валидна */
export function validateRouletteSelection(sel: any): string | null {
  if (!sel || typeof sel !== 'object') return 'selection обязателен';
  switch (sel.type) {
    case 'straight':
      return Number.isInteger(sel.number) && sel.number >= 0 && sel.number <= 36 ? null : 'straight: number 0..36';
    case 'dozen':
      return [1, 2, 3].includes(sel.dozen) ? null : 'dozen: dozen 1|2|3';
    case 'red':
    case 'black':
    case 'even':
    case 'odd':
    case 'low':
    case 'high':
      return null;
    default:
      return 'selection.type: straight | dozen | red | black | even | odd | low | high';
  }
}

export function describeSelection(sel: RouletteSelection): string {
  if (sel.type === 'straight') return `#${sel.number}`;
  if (sel.type === 'dozen') return `dozen ${sel.dozen}`;
  return sel.type;
}
