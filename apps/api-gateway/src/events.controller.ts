import { Controller, MessageEvent, Query, Sse } from '@nestjs/common';
import { bufferTime, filter, interval, map, merge, Observable } from 'rxjs';
import { EventStreamService } from './event-stream.service';

const FEED_WINDOW_MS = 1_000;
const FEED_MAX_PER_WINDOW = 8;

@Controller('events')
export class EventsController {
  constructor(private readonly stream: EventStreamService) {}

  /**
   * Server-Sent Events: GET /events/stream?playerId=...
   *   crash        — жизненный цикл раундов краша (всем)
   *   feed         — пачка последних ставок всех игроков, не чаще раза в секунду (всем)
   *   bet          — итог СВОЕЙ ставки
   *   rejected / tx / alert / notification — свои отказы, движение денег, блокировки, уведомления
   *   ping         — keep-alive каждые 15 с, чтобы прокси не рвали соединение
   */
  @Sse('stream')
  events(@Query('playerId') playerId?: string): Observable<MessageEvent> {
    const events$ = this.stream.events$;

    const global$ = events$.pipe(filter((e) => e.playerId === undefined));
    const personal$ = events$.pipe(filter((e) => !!playerId && e.playerId === playerId));
    // Лента ставок прореживается: при `pnpm flood` в Kafka тысячи событий в секунду,
    // а браузеру хватит нескольких последних
    const feed$ = events$.pipe(
      filter((e) => e.type === 'bet'),
      bufferTime(FEED_WINDOW_MS),
      filter((batch) => batch.length > 0),
      map((batch) => ({ type: 'feed' as const, data: batch.slice(-FEED_MAX_PER_WINDOW).map((e) => e.data) })),
    );
    const ping$ = interval(15_000).pipe(map(() => ({ type: 'ping' as const, data: { t: Date.now() } })));

    return merge(global$, personal$, feed$, ping$).pipe(map((e) => ({ type: e.type, data: e.data })));
  }
}
