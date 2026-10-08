import { useQuery } from '@tanstack/react-query';
import { api, type Bet, type PlayerDetails, type PlayerSummary } from '@/shared/api';
import { usePlayerStore } from '../model/store';

export const playerKeys = {
  all: ['players'] as const,
  list: (persona?: string) => ['players', 'list', persona ?? 'all'] as const,
  detail: (id: string) => ['players', 'detail', id] as const,
  bets: (id: string) => ['players', 'bets', id] as const,
};

export function usePlayers(persona?: string, limit = 24) {
  return useQuery({
    queryKey: playerKeys.list(persona),
    queryFn: () => {
      const q = new URLSearchParams({ limit: String(limit) });
      if (persona) q.set('persona', persona);
      return api<PlayerSummary[]>(`/players?${q}`);
    },
  });
}

export function usePlayer(id: string | null) {
  return useQuery({
    queryKey: playerKeys.detail(id ?? ''),
    queryFn: () => api<PlayerDetails>(`/players/${id}`),
    enabled: !!id,
  });
}

export function usePlayerBets(id: string | null, limit = 30) {
  return useQuery({
    queryKey: playerKeys.bets(id ?? ''),
    queryFn: () => api<Bet[]>(`/players/${id}/bets?limit=${limit}`),
    enabled: !!id,
  });
}

/** Текущий выбранный игрок + его данные с сервера */
export function useCurrentPlayer() {
  const playerId = usePlayerStore((s) => s.playerId);
  const hydrated = usePlayerStore((s) => s.hydrated);
  const query = usePlayer(playerId);
  return { playerId, hydrated, player: query.data, isLoading: query.isLoading, error: query.error };
}
