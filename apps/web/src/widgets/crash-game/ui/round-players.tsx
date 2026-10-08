'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCrashStore } from '@/entities/crash';
import { PlayerAvatar, usePlayerStore } from '@/entities/player';
import { formatMultiplier } from '@/shared/lib/crash';
import { cn } from '@/shared/lib/cn';
import { Chips } from '@/shared/ui';

/** Игроки текущего раунда: обновляется по событиям BET_JOINED / CASHOUT из Kafka */
export function RoundPlayers() {
  const t = useTranslations('crash');
  const bets = useCrashStore((s) => s.bets);
  const phase = useCrashStore((s) => s.phase);
  const me = usePlayerStore((s) => s.playerId);
  const total = bets.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold">
          <Users className="size-4 text-muted-foreground" />
          {t('players', { count: bets.length })}
        </span>
        <Chips value={total} className="text-muted-foreground" />
      </div>
      {bets.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{t('noPlayers')}</p>
      ) : (
        <ul className="grid max-h-80 gap-1 overflow-y-auto pr-1">
          {bets.map((b, i) => (
            <li
              key={`${b.playerId}-${i}`}
              className={cn('flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm', b.playerId === me ? 'bg-primary/10' : 'odd:bg-foreground/[0.03]')}
            >
              <PlayerAvatar username={b.username} className="size-7 rounded-lg text-[9px]" />
              <span className="min-w-0 flex-1 truncate font-medium">{b.username}</span>
              <Chips value={b.amount} className="text-muted-foreground" />
              <span className="w-24 text-right font-mono text-xs font-semibold tabular-nums">
                {b.cashedOutAt !== null ? (
                  <span className="text-win">
                    {formatMultiplier(b.cashedOutAt)}
                  </span>
                ) : phase === 'crashed' ? (
                  <span className="text-loss line-through">{t('lost')}</span>
                ) : b.autoCashout ? (
                  <span className="text-muted-foreground">auto {formatMultiplier(b.autoCashout)}</span>
                ) : (
                  <span className="text-muted-foreground">···</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
