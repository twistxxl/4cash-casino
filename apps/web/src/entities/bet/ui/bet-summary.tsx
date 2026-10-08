'use client';

import { useTranslations } from 'next-intl';
import type { CrashResult, GameType, RouletteResult, RouletteSelection } from '@/shared/api';
import { formatMultiplier } from '@/shared/lib/crash';
import { cn } from '@/shared/lib/cn';

const POCKET = {
  red: 'bg-[var(--wheel-red)] text-white',
  black: 'bg-[var(--wheel-black)] text-white',
  green: 'bg-[var(--wheel-green)] text-white',
} as const;

export function RoulettePocket({ number, color, className }: { number: number; color: keyof typeof POCKET; className?: string }) {
  return (
    <span className={cn('inline-grid size-7 shrink-0 place-items-center rounded-lg font-mono text-xs font-bold', POCKET[color], className)}>
      {number}
    </span>
  );
}

export function useSelectionLabel() {
  const t = useTranslations('roulette.bet');
  return (sel: RouletteSelection) => {
    if (sel.type === 'straight') return t('straight', { number: sel.number });
    if (sel.type === 'dozen') return t('dozen', { dozen: sel.dozen });
    return t(sel.type);
  };
}

/** Краткое описание результата ставки: число на рулетке или точка краша */
export function BetResultInfo({ game, result }: { game: GameType; result: RouletteResult | CrashResult | null }) {
  const t = useTranslations('bets');
  const label = useSelectionLabel();
  if (!result) return <span className="text-muted-foreground">—</span>;

  if (game === 'roulette') {
    const r = result as RouletteResult;
    return (
      <span className="inline-flex min-w-0 items-center gap-2">
        <RoulettePocket number={r.number} color={r.color} />
        <span className="truncate text-muted-foreground">{t('on', { selection: label(r.selection) })}</span>
      </span>
    );
  }

  const c = result as CrashResult;
  if (c.cancelled) return <span className="text-muted-foreground">{t('cancelled')}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 font-mono text-xs">
      <span className="text-muted-foreground">💥 {c.crashPoint ? formatMultiplier(c.crashPoint) : '—'}</span>
      {c.cashedOutAt ? <span className="text-win">↗ {formatMultiplier(c.cashedOutAt)}</span> : null}
    </span>
  );
}
