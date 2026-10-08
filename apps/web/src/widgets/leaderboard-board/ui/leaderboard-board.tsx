'use client';

import { CircleDot, Crown, TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CrashHistory } from '@/entities/crash';
import { useLeaderboard } from '@/entities/leaderboard';
import { PlayerAvatar, usePlayerStore } from '@/entities/player';
import type { GameType, Leaderboard } from '@/shared/api';
import { formatMultiplier } from '@/shared/lib/crash';
import { cn } from '@/shared/lib/cn';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Chips, Skeleton } from '@/shared/ui';

const GAME_ICON = { roulette: CircleDot, crash: TrendingUp } as const;

function GameCard({ game, data }: { game: GameType; data: Leaderboard['games'][GameType] }) {
  const t = useTranslations('leaderboard');
  const tg = useTranslations('bets.game');
  const Icon = GAME_ICON[game];
  return (
    <Card>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/12 text-primary">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="font-display font-bold">{tg(game)}</p>
            <p className="text-xs text-muted-foreground">{t('bets', { count: data.bets })}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">RTP</p>
            <p className="font-display text-2xl font-bold">{data.rtp}</p>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          {(
            [
              ['wagered', data.wagered],
              ['paid', data.paid],
              ['ggr', data.ggr],
            ] as const
          ).map(([key, value]) => (
            <div key={key} className="rounded-xl bg-foreground/[0.04] px-3 py-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{t(key)}</dt>
              <dd className={cn('font-semibold', key === 'ggr' && (value >= 0 ? 'text-win' : 'text-loss'))}>
                <Chips value={value} signed={key === 'ggr'} />
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

export function LeaderboardBoard() {
  const t = useTranslations('leaderboard');
  const tg = useTranslations('bets.game');
  const me = usePlayerStore((s) => s.playerId);
  const { data, isLoading, isError } = useLeaderboard();

  if (isLoading) {
    return (
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-96 rounded-3xl md:col-span-2" />
      </div>
    );
  }
  if (isError || !data || data.error) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('unavailable')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 md:grid-cols-2">
        <GameCard game="roulette" data={data.games.roulette} />
        <GameCard game="crash" data={data.games.crash} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>{t('topWinners')}</CardTitle>
            <CardDescription>{t('topWinnersHint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="grid gap-1">
              {data.topWinners.map((row, i) => (
                <li
                  key={row.playerId}
                  className={cn('flex items-center gap-3 rounded-xl px-2 py-2 text-sm', row.playerId === me ? 'bg-primary/10' : 'odd:bg-foreground/[0.03]')}
                >
                  <span className={cn('w-6 text-center font-display font-bold', i < 3 ? 'text-primary' : 'text-muted-foreground')}>
                    {i === 0 ? <Crown className="mx-auto size-4 text-warn" /> : i + 1}
                  </span>
                  <PlayerAvatar username={row.username} className="size-8 rounded-lg text-[10px]" />
                  <span className="min-w-0 flex-1 truncate font-semibold">{row.username}</span>
                  <span className="hidden text-xs text-muted-foreground sm:inline">{t('bets', { count: row.bets })}</span>
                  <Chips value={row.net} signed className={cn('w-28 justify-end font-bold', row.net >= 0 ? 'text-win' : 'text-loss')} />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
        <div className="grid content-start gap-5">
          <Card>
            <CardHeader>
              <CardTitle>{t('biggestWins')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {data.biggestWins.map((w, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <PlayerAvatar username={w.username} className="size-8 rounded-lg text-[10px]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{w.username}</p>
                      <p className="text-xs text-muted-foreground">
                        {tg(w.game)} · <Chips value={w.amount} />
                      </p>
                    </div>
                    <Chips value={w.payout - w.amount} signed className="font-bold text-win" />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('crashStats')}</CardTitle>
              <CardDescription>
                {t('crashStatsHint', {
                  rounds: data.crash.rounds,
                  median: data.crash.median ? formatMultiplier(data.crash.median) : '—',
                  instant: data.crash.instantCrashes,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CrashHistory points={data.crash.last} className="flex-wrap" />
            </CardContent>
          </Card>
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground">{t('source', { count: data.processedBets })}</p>
    </div>
  );
}
