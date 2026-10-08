'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { playerKeys } from '@/entities/player';
import { api, type CashoutResponse, type PlaceBetResponse, type RouletteSelection } from '@/shared/api';
import { useErrorMessage } from '@/shared/lib';

/**
 * Ставка — асинхронная операция: gateway кладёт bets.placed в Kafka и сразу отвечает 202 с betId.
 * Списание, игра и выплата произойдут позже; итог придёт по SSE.
 */
export function usePlaceRouletteBet(playerId: string | null) {
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: (input: { amount: number; selection: RouletteSelection }) =>
      api<PlaceBetResponse>('/bets/roulette', { method: 'POST', json: { playerId, ...input } }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function usePlaceCrashBet(playerId: string | null) {
  const errorMessage = useErrorMessage();
  return useMutation({
    mutationFn: (input: { amount: number; autoCashout?: number }) =>
      api<PlaceBetResponse>('/bets/crash', { method: 'POST', json: { playerId, ...input } }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}

/** Кэшаут — синхронный RPC через RabbitMQ: нужен ответ «на каком множителе вышел» */
export function useCrashCashout(playerId: string | null) {
  const errorMessage = useErrorMessage();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<CashoutResponse>('/crash/cashout', { method: 'POST', json: { playerId } }),
    onSuccess: () => playerId && qc.invalidateQueries({ queryKey: playerKeys.bets(playerId) }),
    onError: (e) => toast.error(errorMessage(e)),
  });
}
