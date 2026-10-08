'use client';

import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { PersonaBadge, PlayerAvatar, StatusBadge, usePlayers, usePlayerStore } from '@/entities/player';
import type { PlayerSummary } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { Chips, Skeleton } from '@/shared/ui';

function PlayerCard({ player, active, onPick }: { player: PlayerSummary; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        'glass group flex w-full min-w-0 items-center gap-3 rounded-2xl p-3 text-left transition hover:-translate-y-0.5 hover:[background:var(--glass-strong)] focus-visible:ring-2 focus-visible:ring-ring',
        active && 'ring-2 ring-primary',
      )}
    >
      <PlayerAvatar username={player.username} className="size-10" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{player.username}</span>
        <span className="mt-1 flex flex-wrap gap-1">
          <PersonaBadge persona={player.persona} />
          <StatusBadge status={player.status} />
        </span>
      </span>
      <Chips value={player.balance} className="text-sm font-semibold text-muted-foreground group-hover:text-foreground" />
    </button>
  );
}

/** Выбор игрока: демо-игроки сверху, ниже — игроки из seed с самым большим балансом */
export function PlayerPicker({ onPicked }: { onPicked?: () => void }) {
  const t = useTranslations('player.pick');
  const demo = usePlayers('demo', 3);
  const top = usePlayers(undefined, 9);
  const { playerId, select } = usePlayerStore();

  const pick = (p: PlayerSummary) => {
    select(p.id);
    toast.success(t('selected', { username: p.username }));
    onPicked?.();
  };

  const others = (top.data ?? []).filter((p) => p.persona !== 'demo').slice(0, 6);
  const loading = demo.isLoading || top.isLoading;

  if (demo.isError && top.isError) {
    return <p className="rounded-2xl bg-loss/10 p-4 text-sm text-loss">{t('apiDown')}</p>;
  }

  return (
    <div className="grid gap-5">
      <section className="grid gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('demo')}</h3>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {loading
            ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[66px] rounded-2xl" />)
            : demo.data?.map((p) => <PlayerCard key={p.id} player={p} active={p.id === playerId} onPick={() => pick(p)} />)}
        </div>
      </section>
      {(loading || others.length > 0) && (
        <section className="grid gap-2.5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('others')}</h3>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-[66px] rounded-2xl" />)
              : others.map((p) => <PlayerCard key={p.id} player={p} active={p.id === playerId} onPick={() => pick(p)} />)}
          </div>
        </section>
      )}
    </div>
  );
}
