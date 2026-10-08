'use client';

import { ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { CreatePlayerDialog } from '@/features/create-player';
import { PlayerPicker } from '@/features/select-player';
import { useCurrentPlayer } from '@/entities/player';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Skeleton } from '@/shared/ui';

/** Страницы игр и кошелька доступны только с выбранным игроком */
export function PlayerGate({ children }: { children: ReactNode }) {
  const t = useTranslations('player');
  const { hydrated, playerId, player, error } = useCurrentPlayer();

  if (!hydrated || (playerId && !player && !error)) {
    return <Skeleton className="h-[420px] rounded-3xl" />;
  }

  if (!playerId || !player) {
    return (
      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl">{t('gate.title')}</CardTitle>
            <CardDescription className="mt-1">{t('gate.text')}</CardDescription>
          </div>
          <CreatePlayerDialog />
        </CardHeader>
        <CardContent>
          <PlayerPicker />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {player.status === 'blocked' && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-loss/30 bg-loss/10 p-4 text-sm">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-loss" />
          <div>
            <p className="font-semibold text-loss">{t('blocked.title')}</p>
            <p className="text-muted-foreground">{t('blocked.text')}</p>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
