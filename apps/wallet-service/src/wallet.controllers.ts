import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, MessagePattern, Payload, RmqContext, Transport } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { BetPlaced, BetSettled, PayoutResult, RiskAlert, RMQ_PATTERNS, TOPICS } from '@app/common';
import { WalletService } from './wallet.service';

/*
 * wallet-service — гибридное приложение: один Kafka-консьюмер и два RabbitMQ-консьюмера.
 * Второй аргумент декоратора (Transport.KAFKA / Transport.RMQ) говорит Nest,
 * какому транспорту принадлежит обработчик. Без него Kafka-сервер попытался бы
 * подписаться на топики "wallet.deposit" и т.п.
 */

/** Kafka: события ставок и риск-алерты */
@Controller()
export class WalletEventsController {
  private readonly logger = new Logger('WalletEvents');

  constructor(private readonly wallet: WalletService) {}

  @EventPattern(TOPICS.BETS_PLACED, Transport.KAFKA)
  async onBetPlaced(@Payload() e: BetPlaced, @Ctx() ctx: KafkaContext) {
    await this.safe(ctx, () => this.wallet.processBet(e));
  }

  @EventPattern(TOPICS.BETS_SETTLED, Transport.KAFKA)
  async onBetSettled(@Payload() e: BetSettled, @Ctx() ctx: KafkaContext) {
    await this.safe(ctx, () => this.wallet.settleBet(e));
  }

  @EventPattern(TOPICS.RISK_ALERTS, Transport.KAFKA)
  async onRiskAlert(@Payload() e: RiskAlert, @Ctx() ctx: KafkaContext) {
    await this.safe(ctx, () => this.wallet.applyRiskAlert(e));
  }

  /** Ошибку логируем и идём дальше — иначе одно "ядовитое" сообщение остановит партицию */
  private async safe(ctx: KafkaContext, fn: () => Promise<void>) {
    try {
      await fn();
    } catch (e) {
      this.logger.error(
        `${ctx.getTopic()} p=${ctx.getPartition()} offset=${ctx.getMessage().offset}: ${(e as Error).message}`,
      );
    }
  }
}

/** RabbitMQ RPC (очередь wallet.rpc): синхронные запросы от gateway */
@Controller()
export class WalletRpcController {
  constructor(private readonly wallet: WalletService) {}

  @MessagePattern(RMQ_PATTERNS.WALLET_REGISTER, Transport.RMQ)
  register(@Payload() data: any) {
    return this.wallet.register(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_LIST_PLAYERS, Transport.RMQ)
  list(@Payload() data: any) {
    return this.wallet.listPlayers(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_GET_PLAYER, Transport.RMQ)
  get(@Payload() data: { playerId: string }) {
    return this.wallet.getPlayer(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_DEPOSIT, Transport.RMQ)
  deposit(@Payload() data: any) {
    return this.wallet.deposit(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_WITHDRAW, Transport.RMQ)
  withdraw(@Payload() data: any) {
    return this.wallet.withdraw(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_UNBLOCK, Transport.RMQ)
  unblock(@Payload() data: { playerId: string }) {
    return this.wallet.unblock(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_GET_BET, Transport.RMQ)
  getBet(@Payload() data: { betId: string }) {
    return this.wallet.getBet(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_PLAYER_BETS, Transport.RMQ)
  playerBets(@Payload() data: { playerId: string; limit?: number }) {
    return this.wallet.playerBets(data);
  }

  @MessagePattern(RMQ_PATTERNS.WALLET_RECENT_BETS, Transport.RMQ)
  recentBets(@Payload() data: { limit?: number }) {
    return this.wallet.recentBets(data);
  }
}

/** RabbitMQ (очередь payouts.results, ручной ack): итоги выплат от payments-service */
@Controller()
export class PayoutResultsController {
  private readonly logger = new Logger('PayoutResults');

  constructor(private readonly wallet: WalletService) {}

  @EventPattern(RMQ_PATTERNS.PAYOUT_RESULT, Transport.RMQ)
  async onResult(@Payload() r: PayoutResult, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef() as Channel;
    const msg = ctx.getMessage() as Message;
    try {
      await this.wallet.applyPayoutResult(r);
      channel.ack(msg);
    } catch (e) {
      // requeue=true: БД могла моргнуть — пусть сообщение вернётся в очередь
      this.logger.error(`payout.result ${r.withdrawalId}: ${(e as Error).message} → requeue`);
      channel.nack(msg, false, true);
    }
  }
}
