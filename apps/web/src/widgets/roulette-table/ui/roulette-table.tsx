'use client';

import { useQueryClient } from '@tanstack/react-query';
import { LoaderCircle, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { RoulettePocket, useBetResults, useSelectionLabel } from '@/entities/bet';
import { playerKeys, useCurrentPlayer } from '@/entities/player';
import { usePlaceRouletteBet } from '@/features/place-bet';
import { api, type Bet, type RouletteResult, type RouletteSelection } from '@/shared/api';
import { cn } from '@/shared/lib/cn';
import { payoutOdds } from '@/shared/lib/roulette';
import { Badge, Button, Card, CardContent, Chips } from '@/shared/ui';
import { Board } from './board';
import { rotationFor, Wheel } from './wheel';

const CHIPS = [10, 25, 50, 100, 500, 1000];
const FALLBACK_POLL_MS = 5_000;

type Stage = 'idle' | 'waiting' | 'spinning';
interface Outcome {
  number: number;
  color: RouletteResult['color'];
  won: boolean;
  amount: number;
  payout: number;
}

/**
 * Поток одного спина:
 *   POST /bets/roulette (202, betId) → ждём bets.settled по SSE → крутим колесо → показываем итог.
 * Если SSE почему-то молчит — через 5 с спрашиваем GET /bets/:id (запасной путь).
 */
export function RouletteTable() {
  const t = useTranslations('roulette');
  const label = useSelectionLabel();
  const qc = useQueryClient();
  const { playerId, player } = useCurrentPlayer();
  const place = usePlaceRouletteBet(playerId);

  const [selection, setSelection] = useState<RouletteSelection | null>({ type: 'red' });
  const [amount, setAmount] = useState(50);
  const [stage, setStage] = useState<Stage>('idle');
  const [betId, setBetId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [pending, setPending] = useState<Outcome | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [history, setHistory] = useState<Array<{ number: number; color: RouletteResult['color'] }>>([]);

  const result = useBetResults((s) => (betId ? s.results[betId] : undefined));
  const putResult = useBetResults((s) => s.put);

  // Итог ставки пришёл (обычно через SSE за доли секунды) — запускаем колесо
  useEffect(() => {
    if (!result || stage !== 'waiting') return;
    if (result.kind === 'rejected') {
      // тост об отказе показывает общий обработчик SSE (core/providers/live-events)
      setStage('idle');
      setBetId(null);
      return;
    }
    const r = result.bet.result as RouletteResult;
    setPending({ number: r.number, color: r.color, won: result.bet.outcome === 'win', amount: result.bet.amount, payout: result.bet.payout });
    setRotation((current) => rotationFor(r.number, current));
    setStage('spinning');
  }, [result, stage]);

  // Запасной путь: SSE отвалился — опрашиваем статус ставки
  useEffect(() => {
    if (stage !== 'waiting' || !betId) return;
    const timer = setInterval(async () => {
      const bet = await api<Bet>(`/bets/${betId}`).catch(() => null);
      if (bet?.status === 'settled' && bet.result) {
        putResult(betId, {
          kind: 'settled',
          bet: {
            betId,
            playerId: playerId!,
            username: player?.username ?? '',
            game: 'roulette',
            amount: bet.amount,
            payout: bet.payout ?? 0,
            outcome: bet.outcome ?? 'loss',
            result: bet.result as RouletteResult,
            settledAt: bet.settledAt ?? new Date().toISOString(),
          },
        });
      } else if (bet?.status === 'rejected') {
        putResult(betId, { kind: 'rejected', bet: { betId, playerId: playerId!, game: 'roulette', amount: bet.amount, reason: bet.rejectReason ?? '' } });
      }
    }, FALLBACK_POLL_MS);
    return () => clearInterval(timer);
  }, [stage, betId, playerId, player?.username, putResult]);

  const onSpinEnd = useCallback(() => {
    if (!pending) return;
    setOutcome(pending);
    setHistory((h) => [{ number: pending.number, color: pending.color }, ...h].slice(0, 14));
    setStage('idle');
    setBetId(null);
    if (playerId) qc.invalidateQueries({ queryKey: playerKeys.bets(playerId) });
  }, [pending, playerId, qc]);

  const spin = async () => {
    if (!selection || stage !== 'idle') return;
    setOutcome(null);
    const res = await place.mutateAsync({ amount, selection }).catch(() => null);
    if (!res) return;
    setBetId(res.betId);
    setStage('waiting');
  };

  const busy = stage !== 'idle' || place.isPending;
  const blocked = player?.status === 'blocked';
  const notEnough = (player?.balance ?? 0) < amount;
  const odds = selection ? payoutOdds(selection) : 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
      <Card className="flex flex-col items-center gap-5 p-5 sm:p-6">
        <div className="flex min-h-7 w-full gap-1.5 overflow-x-auto [scrollbar-width:none]" aria-label={t('history')}>
          {history.length === 0 ? (
            <span className="text-xs text-muted-foreground">{t('historyEmpty')}</span>
          ) : (
            history.map((h, i) => <RoulettePocket key={i} number={h.number} color={h.color} className={cn(i === 0 && 'ring-2 ring-accent')} />)
          )}
        </div>
        <Wheel rotation={rotation} spinning={stage === 'spinning'} onSpinEnd={onSpinEnd} />
        <div className="grid min-h-[76px] w-full place-items-center text-center" aria-live="polite">
          {stage === 'waiting' && (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              {t('waiting')}
            </p>
          )}
          {stage === 'spinning' && <p className="text-sm font-semibold text-muted-foreground">{t('spinning')}</p>}
          {stage === 'idle' && outcome && (
            <div className="grid animate-in justify-items-center gap-1 zoom-in-95 fade-in-0">
              <div className="flex items-center gap-2">
                <RoulettePocket number={outcome.number} color={outcome.color} className="size-9 text-sm" />
                <span className="font-display text-2xl font-bold">{t(`color.${outcome.color}`)}</span>
              </div>
              {outcome.won ? (
                <Badge variant="win" className="text-sm">
                  {t('won')} <Chips value={outcome.payout - outcome.amount} signed />
                </Badge>
              ) : (
                <Badge variant="loss" className="text-sm">
                  {t('lost')} <Chips value={-outcome.amount} signed />
                </Badge>
              )}
            </div>
          )}
          {stage === 'idle' && !outcome && <p className="text-sm text-muted-foreground">{t('hint')}</p>}
        </div>
      </Card>

      <Card>
        <CardContent className="grid gap-6">
          <Board selection={selection} onSelect={setSelection} disabled={busy} highlight={stage === 'idle' ? outcome?.number : null} />

          <div className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t('chip')}</span>
            <div className="flex flex-wrap gap-2">
              {CHIPS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  aria-pressed={amount === c}
                  onClick={() => setAmount(c)}
                  className={cn(
                    'grid size-14 place-items-center rounded-full border-[3px] border-dashed font-mono text-sm font-bold transition hover:-translate-y-0.5 disabled:opacity-50',
                    amount === c
                      ? 'border-white/80 bg-primary text-primary-foreground shadow-[0_8px_20px_-6px_var(--primary)]'
                      : 'glass border-primary/40 text-foreground',
                  )}
                >
                  {c >= 1000 ? `${c / 1000}k` : c}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4 rounded-2xl bg-foreground/[0.04] p-4 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1 text-sm">
              {selection ? (
                <>
                  <p className="font-semibold">
                    {t('summary', { selection: label(selection) })} · <Chips value={amount} />
                  </p>
                  <p className="text-muted-foreground">
                    {t('payout', { odds: `${odds}:1` })} · {t('potential')} <Chips value={amount * (odds + 1)} className="font-semibold text-foreground" />
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">{t('selectBet')}</p>
              )}
            </div>
            <Button size="xl" onClick={spin} disabled={!selection || busy || blocked || notEnough} className="sm:min-w-44">
              {busy ? <LoaderCircle className="animate-spin" /> : <RotateCw />}
              {notEnough && !busy ? t('notEnough') : t('spin')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
