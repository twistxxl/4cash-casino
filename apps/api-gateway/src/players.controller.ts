import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import { RMQ_PATTERNS, WALLET_RPC_CLIENT } from '@app/common';
import { assertAmount, assertUuid, rpc } from './util';

/**
 * Всё про игроков и деньги — синхронный RPC в wallet-service через RabbitMQ (очередь wallet.rpc).
 * Клиенту нужен ответ сразу ("сколько у меня денег?"), поэтому не Kafka.
 */
@Controller('players')
export class PlayersController {
  constructor(@Inject(WALLET_RPC_CLIENT) private readonly wallet: ClientProxy) {}

  @Get()
  list(@Query('limit') limit = '20', @Query('persona') persona?: string, @Query('status') status?: string) {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_LIST_PLAYERS, { limit: Number(limit), persona, status });
  }

  @Post()
  register(@Body() body: { username?: string; email?: string; country?: string; deposit?: number }) {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_REGISTER, body);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_GET_PLAYER, { playerId: assertUuid(id, 'id') });
  }

  @Get(':id/bets')
  bets(@Param('id') id: string, @Query('limit') limit = '30') {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_PLAYER_BETS, { playerId: assertUuid(id, 'id'), limit: Number(limit) });
  }

  @Post(':id/deposit')
  deposit(@Param('id') id: string, @Body() body: { amount?: number }) {
    // depositId генерирует gateway: если клиент повторит запрос с тем же id — двойного зачисления не будет
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_DEPOSIT, {
      playerId: assertUuid(id, 'id'),
      amount: assertAmount(body.amount),
      depositId: randomUUID(),
    });
  }

  @Post(':id/withdraw')
  withdraw(@Param('id') id: string, @Body() body: { amount?: number }) {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_WITHDRAW, {
      playerId: assertUuid(id, 'id'),
      amount: assertAmount(body.amount),
      withdrawalId: randomUUID(),
    });
  }

  @Post(':id/unblock')
  unblock(@Param('id') id: string) {
    return rpc(this.wallet, RMQ_PATTERNS.WALLET_UNBLOCK, { playerId: assertUuid(id, 'id') });
  }
}
