import { Body, Controller, Get, Inject, OnModuleInit, Post } from '@nestjs/common';
import { ClientKafka, ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, timeout } from 'rxjs';
import { CRASH_RPC_CLIENT, KAFKA_RPC_CLIENT, RMQ_PATTERNS, TOPICS } from '@app/common';
import { assertUuid, rpc } from './util';

@Controller('crash')
export class CrashController {
  constructor(@Inject(CRASH_RPC_CLIENT) private readonly crash: ClientProxy) {}

  /** Текущий раунд: фаза, множитель, ставки, история */
  @Get()
  state() {
    return rpc(this.crash, RMQ_PATTERNS.CRASH_STATE, {});
  }

  /** Забрать выигрыш на текущем множителе (RabbitMQ RPC — быстро и с ответом) */
  @Post('cashout')
  cashout(@Body() body: { playerId?: string }) {
    return rpc(this.crash, RMQ_PATTERNS.CRASH_CASHOUT, { playerId: assertUuid(body.playerId, 'playerId') }, 3_000);
  }
}

@Controller('leaderboard')
export class LeaderboardController implements OnModuleInit {
  constructor(@Inject(KAFKA_RPC_CLIENT) private readonly kafka: ClientKafka) {}

  async onModuleInit() {
    // Для request-reply поверх Kafka клиент должен подписаться на "<topic>.reply" ДО connect()
    this.kafka.subscribeToResponseOf(TOPICS.LEADERBOARD_GET);
    await this.kafka.connect();
  }

  /** Request-reply поверх Kafka. Работает, но сравни по ощущениям с RabbitMQ RPC выше */
  @Get()
  async get() {
    try {
      return await firstValueFrom(this.kafka.send(TOPICS.LEADERBOARD_GET, {}).pipe(timeout(5_000)));
    } catch (e) {
      return {
        error: (e as Error).message,
        hint: 'leaderboard-service запущен? Сразу после старта consumer group ещё балансируется — повтори через пару секунд',
      };
    }
  }
}
