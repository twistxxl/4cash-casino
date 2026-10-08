import { Injectable, Logger } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomUUID } from 'crypto';
import type { PoolClient } from 'pg';
import {
  BetPlaced,
  BetRejected,
  BetSettled,
  BetAccepted,
  BIG_WIN_THRESHOLD,
  Database,
  NOTIFICATIONS_EXCHANGE,
  NotificationMessage,
  PayoutResult,
  PayoutTask,
  QUEUES,
  RejectReason,
  RiskAlert,
  RMQ_PATTERNS,
  TOPICS,
  TransactionType,
  WalletTransaction,
} from '@app/common';

interface LockedPlayer {
  id: string;
  username: string;
  status: 'active' | 'blocked';
  balance: number;
}

const MAX_MONEY_OP = 1_000_000;
const short = (id: string) => id.slice(0, 8);

/**
 * Вся работа с деньгами. Каждый метод — одна транзакция БД:
 *   1) блокируем строку игрока (SELECT ... FOR UPDATE) — параллельные операции встают в очередь;
 *   2) меняем баланс и пишем журнал;
 *   3) кладём события в outbox (в той же транзакции!) — их опубликует OutboxRelay.
 */
@Injectable()
export class WalletService {
  private readonly logger = new Logger('Wallet');

  constructor(private readonly db: Database) {}

  // ================= Kafka: ставки =================

  /** bets.placed → списать ставку → bets.accepted | bets.rejected */
  async processBet(e: BetPlaced) {
    await this.db.tx(async (c) => {
      // Идемпотентность: если ставка уже есть — это повторная доставка, ничего не делаем
      const ins = await c.query(
        `INSERT INTO wallet.bets (id, player_id, game, amount, selection, status, placed_at)
         VALUES ($1, $2, $3, $4, $5, 'processing', $6) ON CONFLICT (id) DO NOTHING`,
        [e.betId, e.playerId, e.game, e.amount, JSON.stringify(e.selection), e.placedAt],
      );
      if (!ins.rowCount) {
        this.logger.warn(`дубль bets.placed ${short(e.betId)} — пропускаю`);
        return;
      }

      const p = await this.lockPlayer(c, e.playerId);
      const reason: RejectReason | null = !p
        ? 'PLAYER_NOT_FOUND'
        : p.status === 'blocked'
          ? 'PLAYER_BLOCKED'
          : !Number.isInteger(e.amount) || e.amount <= 0
            ? 'INVALID_AMOUNT'
            : p.balance < e.amount
              ? 'INSUFFICIENT_FUNDS'
              : null;

      if (reason) {
        await c.query(`UPDATE wallet.bets SET status = 'rejected', reject_reason = $2 WHERE id = $1`, [e.betId, reason]);
        const rejected: BetRejected = { ...e, reason };
        await this.kafkaEvent(c, TOPICS.BETS_REJECTED, e.playerId, rejected);
        this.logger.warn(`✗ ${p?.username ?? e.playerId}: ставка ${e.amount} на ${e.game} отклонена — ${reason}`);
        return;
      }

      await this.move(c, p!, 'bet', -e.amount, e.betId);
      await c.query(`UPDATE wallet.bets SET status = 'accepted' WHERE id = $1`, [e.betId]);
      const accepted: BetAccepted = { ...e, username: p!.username, balanceAfter: p!.balance };
      await this.kafkaEvent(c, TOPICS.BETS_ACCEPTED, e.playerId, accepted);
      this.logger.log(`✓ ${p!.username}: −${e.amount} (${e.game}) → баланс ${p!.balance}`);
    });
  }

  /** bets.settled → зачислить выигрыш/возврат */
  async settleBet(e: BetSettled) {
    await this.db.tx(async (c) => {
      // WHERE status = 'accepted' — повторное событие ничего не изменит
      const upd = await c.query(
        `UPDATE wallet.bets SET status = 'settled', payout = $2, outcome = $3, result = $4, settled_at = $5
         WHERE id = $1 AND status = 'accepted'`,
        [e.betId, e.payout, e.outcome, JSON.stringify(e.result), e.settledAt],
      );
      if (!upd.rowCount) {
        this.logger.warn(`bets.settled ${short(e.betId)}: ставка не в статусе accepted (дубль?) — пропускаю`);
        return;
      }
      if (e.payout <= 0) return;

      const p = await this.lockPlayer(c, e.playerId);
      await this.move(c, p!, e.outcome === 'refund' ? 'refund' : 'win', e.payout, e.betId);
      this.logger.log(`💰 ${e.username}: +${e.payout} (${e.game}, ${e.outcome}) → баланс ${p!.balance}`);

      if (e.outcome === 'win' && e.payout - e.amount >= BIG_WIN_THRESHOLD) {
        await this.notify(c, 'push.big_win', {
          playerId: e.playerId,
          username: e.username,
          text: `🎉 ${e.username} выиграл ${e.payout} в ${e.game} (ставка ${e.amount})!`,
          meta: { betId: e.betId, game: e.game, amount: e.amount, payout: e.payout, result: e.result },
        });
      }
    });
  }

  /** risk.alerts → заблокировать игрока, если risk-service так решил */
  async applyRiskAlert(alert: RiskAlert) {
    if (alert.action !== 'BLOCK_PLAYER') return;
    await this.db.tx(async (c) => {
      const upd = await c.query(`UPDATE wallet.players SET status = 'blocked' WHERE id = $1 AND status = 'active'`, [
        alert.playerId,
      ]);
      if (!upd.rowCount) return;
      await this.notify(c, 'email.account_blocked', {
        playerId: alert.playerId,
        username: alert.username,
        text: `Аккаунт ${alert.username} заблокирован службой безопасности: ${alert.rule}`,
        meta: { rule: alert.rule, ...alert.details },
      });
      this.logger.error(`⛔ ${alert.username} заблокирован (${alert.rule})`);
    });
  }

  // ================= RabbitMQ RPC =================

  async register(input: { username?: string; email?: string; country?: string; deposit?: number }) {
    const username = input.username?.trim();
    if (!username || username.length < 3) throw new RpcException('username: минимум 3 символа');
    const id = randomUUID();
    try {
      await this.db.query(`INSERT INTO wallet.players (id, username, email, country) VALUES ($1, $2, $3, $4)`, [
        id,
        username,
        input.email ?? `${username}@example.com`,
        input.country ?? 'XX',
      ]);
    } catch (e: any) {
      if (e.code === '23505') throw new RpcException('USERNAME_TAKEN');
      throw e;
    }
    if (input.deposit) await this.deposit({ playerId: id, amount: input.deposit, depositId: randomUUID() });
    return this.getPlayer({ playerId: id });
  }

  async listPlayers(input: { limit?: number; persona?: string; status?: string }) {
    const { rows } = await this.db.query(
      `SELECT id, username, persona, status, balance FROM wallet.players
       WHERE ($1::text IS NULL OR persona = $1) AND ($2::text IS NULL OR status = $2)
       ORDER BY balance DESC LIMIT $3`,
      [input.persona ?? null, input.status ?? null, Math.min(input.limit ?? 20, 200)],
    );
    return rows;
  }

  async getPlayer({ playerId }: { playerId: string }) {
    const { rows } = await this.db.query(
      `SELECT id, username, email, country, persona, status, balance, created_at AS "createdAt"
       FROM wallet.players WHERE id = $1`,
      [playerId],
    );
    if (!rows.length) throw new RpcException('PLAYER_NOT_FOUND');

    const [stats, txs, withdrawals] = await Promise.all([
      this.db.query(
        `SELECT count(*)::int AS bets, coalesce(sum(amount), 0)::float8 AS wagered, coalesce(sum(payout), 0)::float8 AS paid
         FROM wallet.bets WHERE player_id = $1 AND status = 'settled'`,
        [playerId],
      ),
      this.db.query(
        `SELECT type, amount, balance_after AS "balanceAfter", ref_id AS "refId", created_at AS "createdAt"
         FROM wallet.transactions WHERE player_id = $1 ORDER BY id DESC LIMIT 10`,
        [playerId],
      ),
      this.db.query(
        `SELECT id, amount, status, reason, created_at AS "createdAt" FROM wallet.withdrawals
         WHERE player_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [playerId],
      ),
    ]);
    const s = stats.rows[0];
    return {
      ...rows[0],
      stats: { ...s, net: s.paid - s.wagered },
      recentTransactions: txs.rows,
      withdrawals: withdrawals.rows,
    };
  }

  async deposit({ playerId, amount, depositId }: { playerId: string; amount: number; depositId: string }) {
    this.assertAmount(amount);
    return this.db.tx(async (c) => {
      const p = await this.lockPlayer(c, playerId);
      if (!p) throw new RpcException('PLAYER_NOT_FOUND');
      const tx = await this.move(c, p, 'deposit', amount, depositId);
      if (!tx) return { duplicate: true, balance: p.balance };
      await this.notify(c, 'push.deposit_received', {
        playerId,
        username: p.username,
        text: `Пополнение на ${amount} зачислено. Баланс: ${p.balance}`,
        meta: { amount, balance: p.balance },
      });
      this.logger.log(`⬇ ${p.username}: депозит +${amount} → баланс ${p.balance}`);
      return { depositId, balance: p.balance };
    });
  }

  /** Списываем деньги сразу и ставим задачу на выплату в RabbitMQ (через outbox) */
  async withdraw({ playerId, amount, withdrawalId }: { playerId: string; amount: number; withdrawalId: string }) {
    this.assertAmount(amount);
    return this.db.tx(async (c) => {
      const p = await this.lockPlayer(c, playerId);
      if (!p) throw new RpcException('PLAYER_NOT_FOUND');
      if (p.status === 'blocked') throw new RpcException('PLAYER_BLOCKED');
      if (p.balance < amount) throw new RpcException(`INSUFFICIENT_FUNDS: баланс ${p.balance}`);

      const ins = await c.query(
        `INSERT INTO wallet.withdrawals (id, player_id, amount, status) VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (id) DO NOTHING`,
        [withdrawalId, playerId, amount],
      );
      if (!ins.rowCount) return { duplicate: true, withdrawalId };

      await this.move(c, p, 'withdrawal', -amount, withdrawalId);
      const task: PayoutTask = { withdrawalId, playerId, username: p.username, amount, attempt: 1 };
      await this.outbox(c, 'rabbit', '', QUEUES.PAYOUTS, { pattern: RMQ_PATTERNS.PAYOUT_PROCESS, data: task });
      this.logger.log(`⬆ ${p.username}: вывод −${amount} → задача в очередь payouts`);
      return { withdrawalId, status: 'pending', balance: p.balance };
    });
  }

  async unblock({ playerId }: { playerId: string }) {
    const upd = await this.db.query(`UPDATE wallet.players SET status = 'active' WHERE id = $1`, [playerId]);
    if (!upd.rowCount) throw new RpcException('PLAYER_NOT_FOUND');
    return this.getPlayer({ playerId });
  }

  async getBet({ betId }: { betId: string }) {
    const { rows } = await this.db.query(
      `SELECT b.id AS "betId", b.player_id AS "playerId", p.username, b.game, b.amount, b.selection, b.status,
              b.reject_reason AS "rejectReason", b.outcome, b.payout, b.result,
              b.placed_at AS "placedAt", b.settled_at AS "settledAt"
       FROM wallet.bets b LEFT JOIN wallet.players p ON p.id = b.player_id WHERE b.id = $1`,
      [betId],
    );
    return (
      rows[0] ?? {
        betId,
        status: 'unknown',
        hint: 'wallet-service ещё не обработал bets.placed (посмотри lag группы wallet-service-server) или betId неверный',
      }
    );
  }

  /** История ставок игрока (для UI) */
  async playerBets({ playerId, limit = 30 }: { playerId: string; limit?: number }) {
    const { rows } = await this.db.query(
      `SELECT id AS "betId", game, amount, selection, status, reject_reason AS "rejectReason", outcome, payout, result,
              placed_at AS "placedAt", settled_at AS "settledAt"
       FROM wallet.bets WHERE player_id = $1 ORDER BY placed_at DESC LIMIT $2`,
      [playerId, Math.min(limit, 100)],
    );
    return rows;
  }

  /** Последние рассчитанные ставки всех игроков — стартовое наполнение живой ленты */
  async recentBets({ limit = 20 }: { limit?: number }) {
    const { rows } = await this.db.query(
      `SELECT b.id AS "betId", b.player_id AS "playerId", p.username, b.game, b.amount, b.payout, b.outcome, b.result,
              b.settled_at AS "settledAt"
       FROM wallet.bets b JOIN wallet.players p ON p.id = b.player_id
       WHERE b.status = 'settled' AND b.outcome <> 'refund'
       ORDER BY b.settled_at DESC LIMIT $1`,
      [Math.min(limit, 50)],
    );
    return rows;
  }

  // ================= RabbitMQ: результат выплаты =================

  async applyPayoutResult(r: PayoutResult) {
    await this.db.tx(async (c) => {
      const upd = await c.query(
        `UPDATE wallet.withdrawals SET status = $2, reason = $3, updated_at = now()
         WHERE id = $1 AND status = 'pending' RETURNING player_id, amount`,
        [r.withdrawalId, r.status, r.reason ?? null],
      );
      if (!upd.rowCount) return; // повторная доставка
      const { player_id, amount } = upd.rows[0];
      const p = (await this.lockPlayer(c, player_id))!;

      if (r.status === 'completed') {
        await this.notify(c, 'email.withdrawal_completed', {
          playerId: p.id,
          username: p.username,
          text: `Вывод ${amount} отправлен. Номер платежа ${r.providerRef}`,
          meta: { amount, providerRef: r.providerRef },
        });
        this.logger.log(`✅ ${p.username}: вывод ${amount} выплачен`);
      } else {
        // Компенсирующая операция: вернуть деньги на баланс
        await this.move(c, p, 'withdrawal_refund', amount, r.withdrawalId);
        await this.notify(c, 'email.withdrawal_failed', {
          playerId: p.id,
          username: p.username,
          text: `Вывод ${amount} не прошёл (${r.reason}). Деньги вернулись на баланс`,
          meta: { amount, reason: r.reason },
        });
        this.logger.warn(`↩ ${p.username}: вывод ${amount} отклонён (${r.reason}), деньги возвращены`);
      }
    });
  }

  // ================= helpers =================

  private assertAmount(amount: number) {
    if (!Number.isInteger(amount) || amount <= 0 || amount > MAX_MONEY_OP) {
      throw new RpcException(`amount: целое число 1..${MAX_MONEY_OP}`);
    }
  }

  private async lockPlayer(c: PoolClient, id: string): Promise<LockedPlayer | null> {
    const { rows } = await c.query(`SELECT id, username, status, balance FROM wallet.players WHERE id = $1 FOR UPDATE`, [
      id,
    ]);
    return rows[0] ?? null;
  }

  /**
   * Движение денег: запись в журнал + новый баланс + событие wallet.transactions.
   * Возвращает null, если такая операция уже была (UNIQUE (type, ref_id)).
   */
  private async move(
    c: PoolClient,
    p: LockedPlayer,
    type: TransactionType,
    amount: number,
    refId: string,
  ): Promise<WalletTransaction | null> {
    const balanceAfter = p.balance + amount;
    const { rows } = await c.query(
      `INSERT INTO wallet.transactions (player_id, type, amount, balance_after, ref_id)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (type, ref_id) DO NOTHING RETURNING id, created_at`,
      [p.id, type, amount, balanceAfter, refId],
    );
    if (!rows.length) return null;
    await c.query(`UPDATE wallet.players SET balance = $2 WHERE id = $1`, [p.id, balanceAfter]);
    p.balance = balanceAfter;

    const event: WalletTransaction = {
      txId: String(rows[0].id),
      playerId: p.id,
      username: p.username,
      type,
      amount,
      balanceAfter,
      refId,
      createdAt: rows[0].created_at.toISOString(),
    };
    await this.kafkaEvent(c, TOPICS.WALLET_TRANSACTIONS, p.id, event);
    return event;
  }

  private outbox(c: PoolClient, destination: 'kafka' | 'rabbit', target: string, key: string, payload: unknown) {
    return c.query(`INSERT INTO wallet.outbox (destination, target, key, payload) VALUES ($1, $2, $3, $4)`, [
      destination,
      target,
      key,
      JSON.stringify(payload),
    ]);
  }

  private kafkaEvent(c: PoolClient, topic: string, key: string, payload: unknown) {
    return this.outbox(c, 'kafka', topic, key, payload);
  }

  private notify(c: PoolClient, routingKey: string, message: NotificationMessage) {
    return this.outbox(c, 'rabbit', NOTIFICATIONS_EXCHANGE, routingKey, { pattern: RMQ_PATTERNS.NOTIFY, data: message });
  }
}
