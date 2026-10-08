import { create } from 'zustand';
import type { BetRejectedEvent, BetSettledEvent } from '@/shared/api';

export type BetResult = { kind: 'settled'; bet: BetSettledEvent } | { kind: 'rejected'; bet: BetRejectedEvent };

const KEEP = 50;

/**
 * Итоги своих ставок, пришедшие по SSE, по betId.
 * POST /bets/roulette отвечает сразу (202) — результат приходит позже, через Kafka → SSE,
 * и компонент рулетки ждёт его здесь.
 */
export const useBetResults = create<{ results: Record<string, BetResult>; put: (betId: string, result: BetResult) => void }>(
  (set) => ({
    results: {},
    put: (betId, result) =>
      set((s) => {
        const entries = Object.entries({ ...s.results, [betId]: result });
        return { results: Object.fromEntries(entries.slice(-KEEP)) };
      }),
  }),
);
