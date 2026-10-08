'use client';

import { CircleDot, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { BetResultInfo, useFeedStore, useRecentBets } from '@/entities/bet';
import { PlayerAvatar, usePlayerStore } from '@/entities/player';
import { cn } from '@/shared/lib/cn';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Chips, Skeleton } from '@/shared/ui';

/** Лента ставок всех игроков: стартовые данные из GET /bets, дальше — SSE "feed" */
export function LiveFeed({ className, limit = 12 }: { className?: string; limit?: number }) {
  const t = useTranslations('feed');
  const items = useFeedStore((s) => s.items);
  const seed = useFeedStore((s) => s.seed);
  const me = usePlayerStore((s) => s.playerId);
  const recent = useRecentBets(limit);

  useEffect(() => {
    if (recent.data) seed(recent.data);
  }, [recent.data, seed]);

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-win opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-win" />
          </span>
          {t('title')}
        </CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        {recent.isLoading && !items.length ? (
          <div className="grid gap-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : !items.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
        ) : (
          <ul className="grid gap-1.5">
            {items.slice(0, limit).map((b) => {
              const won = b.outcome === 'win';
              const GameIcon = b.game === 'roulette' ? CircleDot : TrendingUp;
              return (
                <li
                  key={b.betId}
                  className={cn(
                    'flex min-w-0 animate-in items-center gap-3 rounded-xl px-2.5 py-2 fade-in-0 slide-in-from-top-1 duration-500',
                    b.playerId === me ? 'bg-primary/10' : 'odd:bg-foreground/[0.025]',
                  )}
                >
                  <PlayerAvatar username={b.username} className="size-8 rounded-lg text-[10px]" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      <span className="truncate">{b.username}</span>
                      <GameIcon className="size-3.5 shrink-0 text-muted-foreground" />
                    </p>
                    <div className="text-xs">
                      <BetResultInfo game={b.game} result={b.result} />
                    </div>
                  </div>
                  <div className="text-right text-sm font-semibold">
                    <Chips value={won ? b.payout - b.amount : -b.amount} signed className={won ? 'text-win' : 'text-muted-foreground'} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
