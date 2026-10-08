'use client';

import { HandCoins, LoaderCircle, Rocket } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useCrashStore, useLiveMultiplier } from '@/entities/crash';
import { useCurrentPlayer } from '@/entities/player';
import { useCrashCashout, usePlaceCrashBet } from '@/features/place-bet';
import { formatMultiplier } from '@/shared/lib/crash';
import { useFormat } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { AmountInput, Badge, Button, Input, Label } from '@/shared/ui';

export function CrashBetPanel() {
  const t = useTranslations('crash');
  const f = useFormat();
  const { playerId, player } = useCurrentPlayer();
  const phase = useCrashStore((s) => s.phase);
  const bets = useCrashStore((s) => s.bets);
  const place = usePlaceCrashBet(playerId);
  const cashout = useCrashCashout(playerId);

  const [amount, setAmount] = useState('100');
  const [autoOn, setAutoOn] = useState(false);
  const [auto, setAuto] = useState('2.00');
  const [queued, setQueued] = useState(false);

  const mine = bets.filter((b) => b.playerId === playerId);
  const active = mine.find((b) => b.cashedOutAt === null);
  const cashed = mine.filter((b) => b.cashedOutAt !== null);

  // Ставка прошла цепочку Kafka → wallet → crash и появилась в раунде
  useEffect(() => {
    if (queued && mine.length) setQueued(false);
  }, [queued, mine.length]);

  const payoutRef = useRef<HTMLSpanElement>(null);
  const activeAmount = active?.amount ?? 0;
  const formatPayout = useCallback((m: number) => f.chips(Math.floor(activeAmount * m)), [activeAmount, f]);
  useLiveMultiplier(payoutRef, formatPayout);

  const autoValue = Number(auto.replace(',', '.'));
  const autoValid = !autoOn || (autoValue >= 1.01 && autoValue <= 100);
  const blocked = player?.status === 'blocked';

  const submit = () =>
    place.mutate(
      { amount: Number(amount), autoCashout: autoOn ? autoValue : undefined },
      { onSuccess: () => setQueued(true) },
    );

  const doCashout = () =>
    cashout.mutate(undefined, {
      onSuccess: (r) =>
        toast.success(t('cashedOut', { multiplier: formatMultiplier(r.multiplier), payout: f.chips(r.bets.reduce((s, b) => s + b.payout, 0)) })),
    });

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="crash-amount">{t('amount')}</Label>
        <AmountInput id="crash-amount" value={amount} onChange={setAmount} presets={[10, 50, 100, 500, 1000]} disabled={place.isPending} />
      </div>

      <div className="grid gap-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="crash-auto">{t('autoCashout')}</Label>
          <button
            type="button"
            role="switch"
            aria-checked={autoOn}
            onClick={() => setAutoOn((v) => !v)}
            className={cn('relative h-6 w-11 rounded-full transition', autoOn ? 'bg-primary' : 'bg-foreground/15')}
          >
            <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition', autoOn && 'translate-x-5')} />
            <span className="sr-only">{t('autoCashout')}</span>
          </button>
        </div>
        <Input
          id="crash-auto"
          inputMode="decimal"
          value={auto}
          disabled={!autoOn}
          onChange={(e) => setAuto(e.target.value.replace(/[^\d.,]/g, '').slice(0, 6))}
          className={cn('font-mono', !autoValid && 'border-loss')}
        />
        <p className="text-xs text-muted-foreground">{t('autoHint')}</p>
      </div>

      {phase === 'running' && active ? (
        <Button variant="win" size="xl" onClick={doCashout} disabled={cashout.isPending} className="h-16 flex-col gap-0">
          <span className="inline-flex items-center gap-2 text-base">
            <HandCoins className="size-5" />
            {t('cashout')}
          </span>
          <span ref={payoutRef} className="font-mono text-sm tabular-nums opacity-90" />
        </Button>
      ) : active ? (
        <Button size="xl" disabled variant="glass" className="h-16">
          <Rocket />
          {t('inRound')}
        </Button>
      ) : queued ? (
        <Button size="xl" disabled variant="glass" className="h-16">
          <LoaderCircle className="animate-spin" />
          {t('queued')}
        </Button>
      ) : (
        <Button
          size="xl"
          className="h-16"
          variant={phase === 'betting' ? 'default' : 'glass'}
          onClick={submit}
          disabled={place.isPending || blocked || !Number(amount) || !autoValid || (player?.balance ?? 0) < Number(amount)}
        >
          {place.isPending ? <LoaderCircle className="animate-spin" /> : <Rocket />}
          {phase === 'betting' ? t('place') : t('placeNext')}
        </Button>
      )}

      {cashed.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cashed.map((b, i) => (
            <Badge key={i} variant="win">
              {t('cashedAt', { multiplier: formatMultiplier(b.cashedOutAt!) })} · +{f.chips(Math.floor(b.amount * b.cashedOutAt!) - b.amount)}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
