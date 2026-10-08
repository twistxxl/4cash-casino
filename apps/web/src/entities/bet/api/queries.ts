import { useQuery } from '@tanstack/react-query';
import { api, type FeedBet } from '@/shared/api';

export function useRecentBets(limit = 20) {
  return useQuery({
    queryKey: ['bets', 'recent', limit],
    queryFn: () => api<FeedBet[]>(`/bets?limit=${limit}`),
    staleTime: 60_000,
  });
}
