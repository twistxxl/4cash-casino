import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { randomInt } from 'crypto';
import {
  BetAccepted,
  BetSettled,
  Database,
  describeSelection,
  KafkaPublisher,
  rouletteColor,
  rouletteOdds,
  RouletteSelection,
  rouletteWins,
  TOPICS,
} from '@app/common';

const COLOR_ICON = { red: '🔴', black: '⚫', green: '🟢' } as const;

@Controller()
export class RouletteController {
  private readonly logger = new Logger('Roulette');

  constructor(
    private readonly db: Database,
    private readonly kafka: KafkaPublisher,
  ) {}

  /**
   * bets.accepted читают и рулетка, и краш (разные consumer group).
   * В Kafka нет маршрутизации как в RabbitMQ — каждый консьюмер сам фильтрует "свои" события.
   */
  @EventPattern(TOPICS.BETS_ACCEPTED)
  async onBetAccepted(@Payload() bet: BetAccepted, @Ctx() ctx: KafkaContext) {
    if (bet.game !== 'roulette') return;
    const sel = bet.selection as RouletteSelection;

    try {
      const number = randomInt(0, 37);
      const won = rouletteWins(sel, number);
      const payout = won ? bet.amount * (rouletteOdds(sel) + 1) : 0;

      // Идемпотентность: при повторной доставке НЕ крутим заново, а берём сохранённый результат.
      // Иначе игрок мог бы получить второй шанс выиграть.
      await this.db.query(
        `INSERT INTO games.roulette_spins (bet_id, player_id, username, amount, selection, number, color, won, payout)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (bet_id) DO NOTHING`,
        [bet.betId, bet.playerId, bet.username, bet.amount, JSON.stringify(sel), number, rouletteColor(number), won, payout],
      );
      const { rows } = await this.db.query(`SELECT number, color, won, payout FROM games.roulette_spins WHERE bet_id = $1`, [
        bet.betId,
      ]);
      const spin = rows[0];

      const settled: BetSettled = {
        betId: bet.betId,
        playerId: bet.playerId,
        username: bet.username,
        game: 'roulette',
        amount: bet.amount,
        payout: spin.payout,
        outcome: spin.won ? 'win' : 'loss',
        result: { number: spin.number, color: spin.color, selection: sel },
        settledAt: new Date().toISOString(),
      };
      // Ждём подтверждения от Kafka ДО того, как Nest закоммитит offset.
      // Упадём здесь — сообщение придёт снова, и мы опубликуем тот же сохранённый результат.
      await this.kafka.publish(TOPICS.BETS_SETTLED, bet.playerId, settled);

      const icon = COLOR_ICON[spin.color as keyof typeof COLOR_ICON];
      const delta = spin.won ? `✓ +${spin.payout}` : `✗ −${bet.amount}`;
      this.logger.log(
        `p=${ctx.getPartition()} ${bet.username}: ${bet.amount} на ${describeSelection(sel)} → ${icon} ${spin.number}  ${delta}`,
      );
    } catch (e) {
      this.logger.error(`ставка ${bet.betId}: ${(e as Error).message}`);
    }
  }
}
