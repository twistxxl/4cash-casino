import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import {
  BetPlaced,
  BetSettled,
  Database,
  KafkaPublisher,
  RabbitPublisher,
  RiskAlert,
  RiskRule,
  TOPICS,
  WalletTransaction,
} from '@app/common';

// Пороги правил
const FREQ_WINDOW_MS = 10_000;
const FREQ_LIMIT = 15; // > 15 ставок за 10 секунд — похоже на бота
const BIG_WIN_NET = 10_000;
const MARTINGALE_STREAK = 3; // 3 удвоения подряд после проигрыша: x → 2x → 4x → 8x
const DEPOSIT_WITHDRAW_WINDOW_MS = 120_000;
const MIN_TURNOVER_RATIO = 0.3; // вывел, отыграв < 30% депозита
const ALERT_COOLDOWN_MS = 60_000;

interface PlayerState {
  username: string;
  recentBets: number[];
  lastSettled?: { amount: number; outcome: string; game: string };
  doublingStreak: number;
  lastDeposit?: { at: number; amount: number };
  turnoverSinceDeposit: number;
  lastAlertAt: Partial<Record<RiskRule, number>>;
}

/**
 * Антифрод: читает ТРИ топика и держит состояние по каждому игроку в памяти.
 *
 * Почему состояние в памяти корректно даже при нескольких экземплярах?
 * Все три топика имеют ключ playerId и одинаковое число партиций → события одного игрока
 * из всех топиков попадают в партицию с одним и тем же номером, а она достаётся одному экземпляру
 * (co-partitioning). Так работают Kafka Streams и подобные системы.
 */
@Controller()
export class RiskController {
  private readonly logger = new Logger('Risk');
  private readonly players = new Map<string, PlayerState>();

  constructor(
    private readonly db: Database,
    private readonly kafka: KafkaPublisher,
    private readonly rabbit: RabbitPublisher,
  ) {}

  /** HIGH_FREQUENCY: слишком много ставок за короткое время (event time, а не время обработки) */
  @EventPattern(TOPICS.BETS_PLACED)
  async onBetPlaced(@Payload() e: BetPlaced) {
    const s = this.state(e.playerId);
    const at = Date.parse(e.placedAt);
    s.recentBets.push(at);
    s.turnoverSinceDeposit += e.amount;

    // События могут приходить НЕ по порядку event time (например, `pnpm flood` шлёт ставки "из прошлого").
    // Поэтому окно считаем строго как [at - 10с, at], а не "всё, что новее at - 10с".
    const inWindow = s.recentBets.filter((t) => t > at - FREQ_WINDOW_MS && t <= at).length;
    const newest = Math.max(...s.recentBets);
    s.recentBets = s.recentBets.filter((t) => t > newest - FREQ_WINDOW_MS * 2);

    if (inWindow > FREQ_LIMIT) {
      await this.alert(e.playerId, 'HIGH_FREQUENCY', 'high', 'BLOCK_PLAYER', {
        betsInWindow: inWindow,
        windowSec: FREQ_WINDOW_MS / 1000,
      });
    }
  }

  /** BIG_WIN и MARTINGALE */
  @EventPattern(TOPICS.BETS_SETTLED)
  async onBetSettled(@Payload() e: BetSettled) {
    const s = this.state(e.playerId, e.username);
    if (e.outcome === 'refund') return;

    const net = e.payout - e.amount;
    if (net >= BIG_WIN_NET) {
      await this.alert(e.playerId, 'BIG_WIN', 'medium', 'NONE', { betId: e.betId, game: e.game, amount: e.amount, payout: e.payout, result: e.result });
    }

    const prev = s.lastSettled;
    const doubledAfterLoss = prev?.game === e.game && prev.outcome === 'loss' && e.amount === prev.amount * 2;
    s.doublingStreak = doubledAfterLoss ? s.doublingStreak + 1 : 0;
    s.lastSettled = { amount: e.amount, outcome: e.outcome, game: e.game };
    if (s.doublingStreak >= MARTINGALE_STREAK) {
      await this.alert(e.playerId, 'MARTINGALE', 'low', 'NONE', { streak: s.doublingStreak, lastStake: e.amount });
    }
  }

  /** DEPOSIT_WITHDRAW: внёс → почти не играл → сразу вывел (типичная схема отмывания/бонус-абьюза) */
  @EventPattern(TOPICS.WALLET_TRANSACTIONS)
  async onTransaction(@Payload() e: WalletTransaction) {
    const s = this.state(e.playerId, e.username);
    const at = Date.parse(e.createdAt);

    if (e.type === 'deposit') {
      s.lastDeposit = { at, amount: e.amount };
      s.turnoverSinceDeposit = 0;
      return;
    }
    if (e.type === 'withdrawal' && s.lastDeposit && at - s.lastDeposit.at < DEPOSIT_WITHDRAW_WINDOW_MS) {
      const ratio = s.turnoverSinceDeposit / s.lastDeposit.amount;
      if (ratio < MIN_TURNOVER_RATIO) {
        await this.alert(e.playerId, 'DEPOSIT_WITHDRAW', 'medium', 'NONE', {
          deposit: s.lastDeposit.amount,
          withdrawal: -e.amount,
          turnover: s.turnoverSinceDeposit,
          secondsAfterDeposit: Math.round((at - s.lastDeposit.at) / 1000),
        });
      }
    }
  }

  private async alert(
    playerId: string,
    rule: RiskRule,
    severity: RiskAlert['severity'],
    action: RiskAlert['action'],
    details: Record<string, unknown>,
  ) {
    const s = this.state(playerId);
    const now = Date.now();
    if ((s.lastAlertAt[rule] ?? 0) > now - ALERT_COOLDOWN_MS) return; // не спамим одним и тем же
    s.lastAlertAt[rule] = now;

    const alert: RiskAlert = {
      alertId: randomUUID(),
      playerId,
      username: s.username,
      rule,
      severity,
      action,
      details,
      detectedAt: new Date().toISOString(),
    };

    try {
      await this.db.query(
        `INSERT INTO risk.alerts (id, player_id, username, rule, severity, action, details, detected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [alert.alertId, playerId, s.username, rule, severity, action, JSON.stringify(details), alert.detectedAt],
      );
      // Kafka: wallet-service прочитает и (если action = BLOCK_PLAYER) заблокирует игрока
      await this.kafka.publish(TOPICS.RISK_ALERTS, playerId, alert);
      // RabbitMQ: задача "уведомить службу безопасности"
      await this.rabbit.notify('admin.risk_alert', {
        playerId,
        username: s.username,
        text: `[${severity.toUpperCase()}] ${rule}: ${s.username}${action === 'BLOCK_PLAYER' ? ' → блокировка' : ''}`,
        meta: details,
      });
      const icon = severity === 'high' ? '🚨' : severity === 'medium' ? '⚠️ ' : 'ℹ️ ';
      this.logger.warn(`${icon} ${rule} ${s.username} ${JSON.stringify(details)}${action === 'BLOCK_PLAYER' ? ' → BLOCK' : ''}`);
    } catch (e) {
      this.logger.error(`не удалось сохранить алерт: ${(e as Error).message}`);
    }
  }

  private state(playerId: string, username?: string): PlayerState {
    let s = this.players.get(playerId);
    if (!s) {
      s = { username: username ?? playerId.slice(0, 8), recentBets: [], doublingStreak: 0, turnoverSinceDeposit: 0, lastAlertAt: {} };
      this.players.set(playerId, s);
    }
    if (username) s.username = username;
    return s;
  }
}
