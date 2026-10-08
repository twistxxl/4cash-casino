'use client';

import { ChevronDown, LogOut, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { PlayerAvatar, useCurrentPlayer, usePlayers, usePlayerStore } from '@/entities/player';
import { Link } from '@/shared/i18n';
import {
  Button,
  Chips,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from '@/shared/ui';

/** Кнопка игрока в шапке: баланс обновляется вживую из SSE (wallet.transactions) */
export function PlayerSwitcher() {
  const t = useTranslations('player');
  const { hydrated, playerId, player } = useCurrentPlayer();
  const { select, clear } = usePlayerStore();
  const demo = usePlayers('demo', 3);

  if (!hydrated || (playerId && !player)) return <Skeleton className="h-10 w-40 rounded-xl" />;

  if (!player) {
    return (
      <Button asChild size="default">
        <Link href="/">{t('choose')}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="glass flex h-11 min-w-0 items-center gap-2 rounded-xl py-1 pr-2 pl-1 text-left transition hover:[background:var(--glass-strong)] focus-visible:ring-2 focus-visible:ring-ring sm:gap-2.5 sm:pr-2.5"
        >
          <PlayerAvatar username={player.username} className="size-8 rounded-lg" />
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-28 truncate text-xs font-semibold leading-tight">{player.username}</span>
            <Chips value={player.balance} className="text-sm font-bold leading-tight text-primary" />
          </span>
          <Chips value={player.balance} className="text-sm font-bold text-primary sm:hidden" />
          <ChevronDown className="size-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>{t('demoPlayers')}</DropdownMenuLabel>
        {demo.data?.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => select(p.id)} disabled={p.id === player.id}>
            <PlayerAvatar username={p.username} className="size-6 rounded-md text-[9px]" />
            <span className="flex-1 truncate">{p.username}</span>
            <Chips value={p.balance} className="text-xs text-muted-foreground" />
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/">
            <Users />
            {t('allPlayers')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={clear}>
          <LogOut />
          {t('leave')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
