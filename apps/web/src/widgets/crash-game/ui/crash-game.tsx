'use client';

import { useTranslations } from 'next-intl';
import { CrashHistory, useCrashStore } from '@/entities/crash';
import { Card, CardContent, Skeleton } from '@/shared/ui';
import { CrashBetPanel } from './crash-bet-panel';
import { CrashChart } from './crash-chart';
import { RoundPlayers } from './round-players';

export function CrashGame() {
  const t = useTranslations('crash');
  const synced = useCrashStore((s) => s.synced);
  const history = useCrashStore((s) => s.history);
  const roundId = useCrashStore((s) => s.roundId);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="flex min-w-0 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-5 py-3">
          <span className="shrink-0 font-mono text-xs text-muted-foreground">{roundId ? t('round', { id: roundId }) : '—'}</span>
          <CrashHistory points={history.slice(0, 15)} className="min-w-0 flex-1" />
        </div>
        {synced ? <CrashChart className="h-[340px] sm:h-[440px]" /> : <Skeleton className="m-5 h-[300px] sm:h-[400px]" />}
      </Card>
      <div className="grid content-start gap-5">
        <Card>
          <CardContent>
            <CrashBetPanel />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <RoundPlayers />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
