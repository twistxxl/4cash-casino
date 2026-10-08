import { useQuery } from '@tanstack/react-query';
import { api, type Leaderboard } from '@/shared/api';

/** Leaderboard собирается leaderboard-service из событий Kafka; запрос — Kafka request-reply */
export function useLeaderboard() {
  return useQuery({
    queryKey: ['leaderboard'],
    queryFn: () => api<Leaderboard>('/leaderboard'),
    refetchInterval: 10_000,
  });
}
