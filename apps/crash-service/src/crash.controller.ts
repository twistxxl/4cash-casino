import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload, Transport } from '@nestjs/microservices';
import { BetAccepted, RMQ_PATTERNS, TOPICS } from '@app/common';
import { CrashEngine } from './crash.engine';

@Controller()
export class CrashController {
  private readonly logger = new Logger('CrashEvents');

  constructor(private readonly engine: CrashEngine) {}

  /** Kafka: деньги списаны — ставка участвует в раунде */
  @EventPattern(TOPICS.BETS_ACCEPTED, Transport.KAFKA)
  async onBetAccepted(@Payload() bet: BetAccepted) {
    if (bet.game !== 'crash') return;
    try {
      await this.engine.acceptBet(bet);
    } catch (e) {
      this.logger.error(`ставка ${bet.betId}: ${(e as Error).message}`);
    }
  }

  /**
   * RabbitMQ RPC: кэшаут должен быть быстрым и с ответом ("на каком множителе я вышел?").
   * Через Kafka это было бы неудобно — нужен request-reply с минимальной задержкой.
   */
  @MessagePattern(RMQ_PATTERNS.CRASH_CASHOUT, Transport.RMQ)
  cashout(@Payload() data: { playerId: string }) {
    return this.engine.cashout(data.playerId);
  }

  @MessagePattern(RMQ_PATTERNS.CRASH_STATE, Transport.RMQ)
  state() {
    return this.engine.state();
  }
}
