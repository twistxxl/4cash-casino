'use client';

import { useTranslations } from 'next-intl';
import type { RouletteSelection } from '@/shared/api';
import { BOARD_ROWS, pocketColor, sameSelection } from '@/shared/lib/roulette';
import { cn } from '@/shared/lib/cn';

const NUMBER_BG = {
  red: 'bg-[var(--wheel-red)]',
  black: 'bg-[var(--wheel-black)]',
  green: 'bg-[var(--wheel-green)]',
} as const;

function Cell({
  selection,
  current,
  onSelect,
  className,
  children,
  disabled,
}: {
  selection: RouletteSelection;
  current: RouletteSelection | null;
  onSelect: (s: RouletteSelection) => void;
  className?: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  const active = sameSelection(current, selection);
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      onClick={() => onSelect(selection)}
      className={cn(
        'relative grid min-h-11 place-items-center rounded-lg text-sm font-bold transition outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed',
        'hover:brightness-110 hover:ring-2 hover:ring-white/60',
        active && 'z-10 scale-[1.06] ring-[3px] ring-accent shadow-[0_0_24px_-4px_var(--accent)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Игровой стол европейской рулетки: зеро, числа 1–36, дюжины и ставки 1:1 */
export function Board({
  selection,
  onSelect,
  disabled,
  highlight,
}: {
  selection: RouletteSelection | null;
  onSelect: (s: RouletteSelection) => void;
  disabled?: boolean;
  highlight?: number | null;
}) {
  const t = useTranslations('roulette.bet');
  const outside = 'glass text-xs uppercase tracking-wide text-foreground';

  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[540px] grid-cols-[repeat(13,minmax(0,1fr))] gap-1.5">
        <Cell
          selection={{ type: 'straight', number: 0 }}
          current={selection}
          onSelect={onSelect}
          disabled={disabled}
          className={cn('row-span-3 text-white', NUMBER_BG.green, highlight === 0 && 'animate-pulse ring-[3px] ring-white')}
        >
          0
        </Cell>
        {BOARD_ROWS.map((row) =>
          row.map((n) => (
            <Cell
              key={n}
              selection={{ type: 'straight', number: n }}
              current={selection}
              onSelect={onSelect}
              disabled={disabled}
              className={cn('font-mono text-white', NUMBER_BG[pocketColor(n)], highlight === n && 'animate-pulse ring-[3px] ring-white')}
            >
              {n}
            </Cell>
          )),
        )}

        <span aria-hidden />
        {([1, 2, 3] as const).map((d) => (
          <Cell key={d} selection={{ type: 'dozen', dozen: d }} current={selection} onSelect={onSelect} disabled={disabled} className={cn('col-span-4', outside)}>
            {t('dozen', { dozen: d })}
          </Cell>
        ))}

        <span aria-hidden />
        {(['low', 'even', 'red', 'black', 'odd', 'high'] as const).map((type) => (
          <Cell
            key={type}
            selection={{ type }}
            current={selection}
            onSelect={onSelect}
            disabled={disabled}
            className={cn(
              'col-span-2',
              type === 'red' ? 'bg-[var(--wheel-red)] text-xs text-white uppercase' : type === 'black' ? 'bg-[var(--wheel-black)] text-xs text-white uppercase' : outside,
            )}
          >
            {t(type)}
          </Cell>
        ))}
      </div>
    </div>
  );
}
