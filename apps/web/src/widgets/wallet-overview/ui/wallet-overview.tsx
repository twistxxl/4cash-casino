'use client';

import { CircleCheck, CircleX, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BetResultInfo } from '@/entities/bet';
import { PersonaBadge, PlayerAvatar, StatusBadge, useCurrentPlayer, usePlayerBets } from '@/entities/player';
import { MoneyForm } from '@/features/wallet-operations';
import type { PlayerDetails, Withdrawal } from '@/shared/api';
import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Chips,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/ui';

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5 rounded-2xl bg-foreground/[0.04] px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-lg font-bold">{children}</span>
    </div>
  );
}

function BalanceCard({ player }: { player: PlayerDetails }) {
  const t = useTranslations('wallet');
  return (
    <Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-24 -right-16 size-64 rounded-full bg-primary/25 blur-3xl" aria-hidden />
      <CardContent className="relative grid gap-6">
        <div className="flex flex-wrap items-center gap-3">
          <PlayerAvatar username={player.username} className="size-12 rounded-2xl text-sm" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-bold">{player.username}</p>
            <div className="flex flex-wrap gap-1.5">
              <PersonaBadge persona={player.persona} />
              <StatusBadge status={player.status} />
            </div>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('balance')}</p>
          <Chips value={player.balance} className="font-display text-4xl font-bold sm:text-5xl" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label={t('stats.bets')}>{player.stats.bets}</Stat>
          <Stat label={t('stats.wagered')}>
            <Chips value={player.stats.wagered} />
          </Stat>
          <Stat label={t('stats.paid')}>
            <Chips value={player.stats.paid} />
          </Stat>
          <Stat label={t('stats.net')}>
            <Chips value={player.stats.net} signed className={player.stats.net >= 0 ? 'text-win' : 'text-loss'} />
          </Stat>
        </div>
      </CardContent>
    </Card>
  );
}

const WITHDRAWAL_ICON = { pending: Clock, completed: CircleCheck, failed: CircleX } as const;
const WITHDRAWAL_BADGE = { pending: 'warn', completed: 'win', failed: 'loss' } as const;

function Withdrawals({ items }: { items: Withdrawal[] }) {
  const t = useTranslations('wallet');
  const f = useFormat();
  if (!items.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ul className="grid gap-1.5">
      {items.map((w) => {
        const Icon = WITHDRAWAL_ICON[w.status];
        return (
          <li key={w.id} className="flex items-center gap-3 rounded-xl px-2 py-2 odd:bg-foreground/[0.03]">
            <Icon className={cn('size-5 shrink-0', w.status === 'completed' ? 'text-win' : w.status === 'failed' ? 'text-loss' : 'text-warn')} />
            <div className="min-w-0 flex-1">
              <Chips value={w.amount} className="font-semibold" />
              <p className="truncate text-xs text-muted-foreground">
                {f.dateTime(w.createdAt)}
                {w.reason ? ` · ${w.reason}` : ''}
              </p>
            </div>
            <Badge variant={WITHDRAWAL_BADGE[w.status]}>{t(`withdrawalStatus.${w.status}`)}</Badge>
          </li>
        );
      })}
    </ul>
  );
}

function Transactions({ player }: { player: PlayerDetails }) {
  const t = useTranslations('wallet');
  const f = useFormat();
  if (!player.recentTransactions.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ul className="grid gap-1">
      {player.recentTransactions.map((tx, i) => (
        <li key={`${tx.refId}-${tx.type}-${i}`} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm odd:bg-foreground/[0.03]">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{t(`tx.${tx.type}`)}</p>
            <p className="text-xs text-muted-foreground">{f.dateTime(tx.createdAt)}</p>
          </div>
          <Chips value={tx.amount} signed className={cn('font-semibold', tx.amount > 0 ? 'text-win' : 'text-foreground')} />
          <Chips value={tx.balanceAfter} className="hidden w-24 justify-end text-muted-foreground sm:inline-flex" />
        </li>
      ))}
    </ul>
  );
}

function BetsHistory({ playerId }: { playerId: string }) {
  const t = useTranslations('wallet');
  const tb = useTranslations('bets');
  const f = useFormat();
  const bets = usePlayerBets(playerId);
  if (bets.isLoading) return <Skeleton className="h-48" />;
  if (!bets.data?.length) return <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
  return (
    <ul className="grid gap-1">
      {bets.data.map((b) => (
        // Телефон: [игра · время | итог] / [результат | ставка]; от sm — одна строка из четырёх колонок
        <li
          key={b.betId}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 text-sm odd:bg-foreground/[0.03] sm:grid-cols-[110px_minmax(0,1fr)_auto_auto]"
        >
          <span className="text-xs text-muted-foreground">
            {tb(`game.${b.game}`)} · {f.time(b.placedAt)}
          </span>
          <span className="col-start-1 row-start-2 min-w-0 text-xs sm:col-start-auto sm:row-start-auto">
            {b.status === 'rejected' ? <span className="text-loss">{tb('rejected', { reason: b.rejectReason ?? '' })}</span> : <BetResultInfo game={b.game} result={b.result} />}
          </span>
          <Chips value={b.amount} className="col-start-2 row-start-2 justify-end text-muted-foreground sm:col-start-auto sm:row-start-auto" />
          <span className="col-start-2 row-start-1 w-20 text-right font-semibold sm:col-start-auto sm:row-start-auto">
            {b.status === 'settled' ? (
              <Chips
                value={(b.payout ?? 0) - b.amount}
                signed
                className={b.outcome === 'win' ? 'text-win' : b.outcome === 'refund' ? 'text-muted-foreground' : 'text-loss'}
              />
            ) : (
              <Badge variant="muted">{tb(`status.${b.status}`)}</Badge>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function WalletOverview() {
  const t = useTranslations('wallet');
  const { player } = useCurrentPlayer();
  if (!player) return null;
  const blocked = player.status === 'blocked';

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 content-start gap-5">
        <BalanceCard player={player} />
        <Card>
          <CardContent>
            <Tabs defaultValue="bets" className="grid gap-4">
              <TabsList className="justify-self-start">
                <TabsTrigger value="bets">{t('tabs.bets')}</TabsTrigger>
                <TabsTrigger value="transactions">{t('tabs.transactions')}</TabsTrigger>
                <TabsTrigger value="withdrawals">
                  {t('tabs.withdrawals')}
                  {player.withdrawals.some((w) => w.status === 'pending') && <span className="size-1.5 rounded-full bg-warn" />}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bets">
                <BetsHistory playerId={player.id} />
              </TabsContent>
              <TabsContent value="transactions">
                <Transactions player={player} />
              </TabsContent>
              <TabsContent value="withdrawals">
                <Withdrawals items={player.withdrawals} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <Card className="content-start">
        <CardHeader>
          <CardTitle>{t('operations')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="deposit" className="grid gap-5">
            <TabsList className="w-full">
              <TabsTrigger value="deposit" className="flex-1">
                {t('deposit.tab')}
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="flex-1">
                {t('withdraw.tab')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="deposit">
              <MoneyForm kind="deposit" playerId={player.id} />
            </TabsContent>
            <TabsContent value="withdraw">
              <MoneyForm kind="withdraw" playerId={player.id} disabled={blocked} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
