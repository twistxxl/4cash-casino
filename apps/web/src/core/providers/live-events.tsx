'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useBetResults, useFeedStore } from '@/entities/bet';
import { useCrashStore } from '@/entities/crash';
import { playerKeys, usePlayerStore } from '@/entities/player';
import { api, openEventStream, type CrashState, type NotificationEvent, type PlayerDetails } from '@/shared/api';
import { useErrorMessage, useFormat } from '@/shared/lib';
import { useStreamStatus } from '@/shared/model/stream-status';

const NOTIFY_KEYS = ['deposit_received', 'big_win', 'withdrawal_completed', 'withdrawal_failed', 'account_blocked'] as const;
type NotifyKey = (typeof NOTIFY_KEYS)[number];

/**
 * Единственная точка, где SSE-события превращаются в состояние приложения:
 *   crash        → useCrashStore (Zustand)
 *   feed         → useFeedStore
 *   bet/rejected → useBetResults + обновление кеша TanStack Query
 *   tx           → баланс игрока прямо в кеше запроса (без перезапроса)
 *   notification → тост (это сообщение прошло через RabbitMQ topic exchange)
 */
export function LiveEvents() {
  const qc = useQueryClient();
  const t = useTranslations('toasts');
  const errorMessage = useErrorMessage();
  const f = useFormat();
  const playerId = usePlayerStore((s) => s.playerId);
  const setStatus = useStreamStatus((s) => s.set);

  // Переводы и форматтер читаем через ref в момент события:
  // так SSE переподключается только при смене игрока, а не при смене языка
  const latest = useRef({ t, errorMessage, f });
  useEffect(() => {
    latest.current = { t, errorMessage, f };
  }, [t, errorMessage, f]);

  useEffect(() => {
    const syncCrash = () =>
      api<CrashState>('/crash')
        .then((state) => useCrashStore.getState().sync(state))
        .catch(() => undefined);

    const notify = (n: NotificationEvent) => {
      const { t, f } = latest.current;
      const key = n.routingKey.split('.')[1] as NotifyKey;
      if (!NOTIFY_KEYS.includes(key)) {
        toast(n.text);
        return;
      }
      const meta = (n.meta ?? {}) as Record<string, string | number | undefined>;
      const message = t(`notify.${key}`, {
        amount: f.chips(Number(meta.amount ?? 0)),
        balance: f.chips(Number(meta.balance ?? 0)),
        payout: f.chips(Number(meta.payout ?? 0)),
        reason: String(meta.reason ?? meta.rule ?? ''),
      });
      if (key === 'withdrawal_failed' || key === 'account_blocked') toast.error(message);
      else toast.success(message, { description: t('viaRabbit') });
    };

    return openEventStream(
      playerId,
      {
        crash: (e) => {
          useCrashStore.getState().apply(e);
          // Ставки, ждавшие следующего раунда, отдельными событиями не приходят — берём полный снимок
          if (e.type === 'BETTING_OPEN' && e.bets) void syncCrash();
        },
        feed: (bets) => useFeedStore.getState().push(bets),
        bet: (e) => {
          useBetResults.getState().put(e.betId, { kind: 'settled', bet: e });
          qc.invalidateQueries({ queryKey: playerKeys.bets(e.playerId) });
          qc.invalidateQueries({ queryKey: playerKeys.detail(e.playerId) });
        },
        rejected: (e) => {
          useBetResults.getState().put(e.betId, { kind: 'rejected', bet: e });
          const { t, errorMessage } = latest.current;
          toast.error(t('rejected', { reason: errorMessage(new Error(e.reason)) }));
        },
        tx: (e) => {
          qc.setQueryData<PlayerDetails>(playerKeys.detail(e.playerId), (old) =>
            old ? { ...old, balance: e.balanceAfter, recentTransactions: [e, ...old.recentTransactions].slice(0, 10) } : old,
          );
        },
        alert: (e) => {
          if (e.action === 'BLOCK_PLAYER') qc.invalidateQueries({ queryKey: playerKeys.detail(e.playerId) });
        },
        notification: (n) => {
          notify(n);
          if (n.routingKey.startsWith('email.withdrawal')) qc.invalidateQueries({ queryKey: playerKeys.detail(n.playerId) });
        },
      },
      (status) => {
        setStatus(status);
        // После (пере)подключения раунд краша мог уйти вперёд — синхронизируемся снимком
        if (status === 'open') void syncCrash();
      },
    );
  }, [playerId, qc, setStatus]);

  return null;
}
