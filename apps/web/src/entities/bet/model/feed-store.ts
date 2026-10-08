import { create } from 'zustand';
import type { FeedBet } from '@/shared/api';

const MAX = 24;

/** Живая лента ставок всех игроков (SSE "feed") */
export const useFeedStore = create<{
  items: FeedBet[];
  push: (bets: FeedBet[]) => void;
  seed: (bets: FeedBet[]) => void;
}>((set) => ({
  items: [],
  push: (bets) =>
    set((s) => {
      const seen = new Set(s.items.map((b) => b.betId));
      const fresh = bets.filter((b) => !seen.has(b.betId)).reverse();
      return { items: [...fresh, ...s.items].slice(0, MAX) };
    }),
  // Стартовое наполнение из GET /bets — только если по SSE ещё ничего не пришло
  seed: (bets) => set((s) => (s.items.length ? s : { items: bets.slice(0, MAX) })),
}));
