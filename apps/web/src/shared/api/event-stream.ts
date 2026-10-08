import { API_URL } from '@/shared/config';
import type { StreamHandlers } from './types';

export type StreamStatus = 'connecting' | 'open' | 'reconnecting';

/**
 * Подключение к SSE gateway. EventSource сам переподключается при обрыве,
 * поэтому здесь только подписка на типы событий и отслеживание статуса.
 * Возвращает функцию отключения — удобно отдавать прямо из useEffect.
 */
export function openEventStream(
  playerId: string | null,
  handlers: StreamHandlers,
  onStatus: (status: StreamStatus) => void,
): () => void {
  const url = new URL('/events/stream', API_URL);
  if (playerId) url.searchParams.set('playerId', playerId);

  const source = new EventSource(url);
  onStatus('connecting');
  source.onopen = () => onStatus('open');
  source.onerror = () => onStatus('reconnecting');

  for (const [type, handler] of Object.entries(handlers)) {
    source.addEventListener(type, (event) => {
      try {
        (handler as (data: unknown) => void)(JSON.parse((event as MessageEvent<string>).data));
      } catch (e) {
        console.error(`SSE "${type}":`, e);
      }
    });
  }

  return () => source.close();
}
