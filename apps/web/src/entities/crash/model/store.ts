import { create } from 'zustand';
import type { CrashPhase, CrashRoundBet, CrashRoundEvent, CrashState } from '@/shared/api';
import { elapsedFor } from '@/shared/lib/crash';

const DEFAULT_BETTING_MS = 7_000;

interface CrashStore {
  synced: boolean;
  roundId: number | null;
  phase: CrashPhase;
  /** Локальное время (Date.now) окончания приёма ставок */
  bettingEndsAt: number | null;
  /** Локальное время старта полёта — от него фронт сам считает множитель каждый кадр */
  startedAt: number | null;
  crashPoint: number | null;
  bets: CrashRoundBet[];
  history: number[];
  /** Полный снимок из GET /crash — при загрузке и после переподключения SSE */
  sync: (state: CrashState) => void;
  /** Инкрементальное обновление из события crash.rounds (Kafka → SSE) */
  apply: (event: CrashRoundEvent) => void;
}

export const useCrashStore = create<CrashStore>((set, get) => ({
  synced: false,
  roundId: null,
  phase: 'idle',
  bettingEndsAt: null,
  startedAt: null,
  crashPoint: null,
  bets: [],
  history: [],

  sync: (s) => {
    const now = Date.now();
    set({
      synced: true,
      roundId: s.roundId,
      phase: s.phase,
      bets: s.bets,
      history: s.history,
      crashPoint: s.crashPoint ?? null,
      bettingEndsAt: s.phase === 'betting' ? now + s.bettingEndsInMs : null,
      // Подключились посреди полёта: восстанавливаем момент старта по текущему множителю
      startedAt: s.phase === 'running' ? now - elapsedFor(s.multiplier) : null,
    });
  },

  apply: (e) => {
    const now = Date.now();
    switch (e.type) {
      case 'BETTING_OPEN':
        set({
          roundId: e.roundId,
          phase: 'betting',
          bettingEndsAt: now + (e.bettingMs ?? DEFAULT_BETTING_MS),
          startedAt: null,
          crashPoint: null,
          bets: [],
        });
        break;
      case 'STARTED':
        set({ roundId: e.roundId, phase: 'running', startedAt: now, bettingEndsAt: null });
        break;
      case 'CRASHED':
        set({
          phase: 'crashed',
          crashPoint: e.crashPoint ?? null,
          history: e.crashPoint !== undefined ? [e.crashPoint, ...get().history].slice(0, 20) : get().history,
        });
        break;
      case 'CANCELLED':
        set({ phase: 'idle', bets: [] });
        break;
      case 'BET_JOINED':
        if (e.roundId !== get().roundId || !e.playerId) return;
        set({
          bets: [
            ...get().bets,
            {
              playerId: e.playerId,
              username: e.username ?? '',
              amount: e.amount ?? 0,
              autoCashout: e.autoCashout ?? null,
              cashedOutAt: null,
            },
          ],
        });
        break;
      case 'CASHOUT': {
        if (e.roundId !== get().roundId) return;
        let marked = false;
        set({
          bets: get().bets.map((b) => {
            if (marked || b.playerId !== e.playerId || b.cashedOutAt !== null || b.amount !== e.amount) return b;
            marked = true;
            return { ...b, cashedOutAt: e.multiplier ?? null };
          }),
        });
        break;
      }
    }
  },
}));
