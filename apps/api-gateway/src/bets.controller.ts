import { BadRequestException, Body, Controller, Get, HttpCode, Inject, Param, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  BetPlaced,
  BetSelection,
  GameType,
  KafkaPublisher,
  RMQ_PATTERNS,
  TOPICS,
  validateRouletteSelection,
  WALLET_RPC_CLIENT,
} from '@app/common';
import { assertAmount, assertUuid, rpc } from './util';

/**
 * Ставка — асинхронная операция. Gateway только публикует bets.placed в Kafka
 * и сразу отвечает 202 Accepted с betId. Дальше:
 *   wallet списывает деньги → bets.accepted → игра считает результат → bets.settled → wallet зачисляет выигрыш.
 * Статус смотри через GET /bets/:id.
 */
@Controller('bets')
export class BetsController {
  constructor(
    private readonly kafka: KafkaPublisher,
    @Inject(WALLET_RPC_CLIENT) private readonly wallet: ClientProxy,
  ) {}

  @Post('roulette')
  @HttpCode(202)
  roulette(@Body() body: { playerId?: string; amount?: number; selection?: unknown }) {
    const error = validateRouletteSelection(body.selection);
    if (error) throw new BadRequestException(error);
    return this.place('roulette', body.playerId, body.amount, body.selection as BetSelection);
  }

  @Post('crash')
  @HttpCode(202)
  crash(@Body() body: { playerId?: string; amount?: number; autoCashout?: number }) {
    const auto = body.autoCashout;
    if (auto !== undefined && !(typeof auto === 'number' && auto >= 1.01 && auto <= 100)) {
      throw new BadRequestException('autoCashout: число 1.01..100 (или не передавать — тогда только ручной кэшаут)');
    }
    return this.place('crash', body.playerId, body.amount, auto !== undefined ? { autoCashout: auto } : {});
  }

  /** Последние ставки всех игроков — стартовое наполнение живой ленты в UI */
  @Get()
  recent(@Query('limit') limit = '20') {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_RECENT_BETS, { limit: Number(limit) });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_GET_BET, { betId: assertUuid(id, 'id') });
  }

  private async place(game: GameType, playerId: unknown, amount: unknown, selection: BetSelection) {
    const event: BetPlaced = {
      betId: randomUUID(),
      playerId: assertUuid(playerId, 'playerId'),
      game,
      amount: assertAmount(amount, 100_000),
      selection,
      placedAt: new Date().toISOString(),
    };
    // key = playerId → все ставки игрока в одной партиции → wallet обработает их строго по порядку
    await this.kafka.publish(TOPICS.BETS_PLACED, event.playerId, event);
    return { betId: event.betId, status: 'placed', check: `GET /bets/${event.betId}` };
  }
}
