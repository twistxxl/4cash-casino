import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { randomInt } from 'crypto';
import {
  BetAccepted,
  BetSettled,
  CrashRoundEvent,
  CrashSelection,
  Database,
  KafkaPublisher,
  sleep,
  TOPICS,
} from '@app/common';

const BETTING_MS = Number(process.env.CRASH_BETTING_MS ?? 7_000);
const PAUSE_MS = 3_000;
const TICK_MS = 100;
/** Множитель растёт экспоненциально: m(t) = e^(GROWTH * t_ms). 2x ≈ 8.7с, 10x ≈ 29с */
const GROWTH = 0.00008;
const MAX_CRASH = 50;
const HOUSE_EDGE = 0.01;

/**
 * Точка краша определяется ДО начала раунда. P(краш ≥ x) = 0.99 / x → RTP 99%.
 * ~2% раундов крашатся сразу на 1.00x — это и есть преимущество казино.
 */
export function generateCrashPoint(): number {
  const r = randomInt(0, 2 ** 32) / 2 ** 32;
  const raw = (1 - HOUSE_EDGE) / (1 - r);
  return Math.min(MAX_CRASH, Math.max(1, Math.floor(raw * 100) / 100));
}

const multiplierAt = (elapsedMs: number) => Math.floor(Math.exp(GROWTH * elapsedMs) * 100) / 100;

interface LiveBet {
  betId: string;
  playerId: string;
  username: string;
  amount: number;
  autoCashout: number | null;
  cashedOutAt: number | null;
}

interface Round {
  id: number;
  phase: 'betting' | 'running' | 'crashed';
  crashPoint: number;
  bettingEndsAt: number;
  startedAt: number | null;
  bets: Map<string, LiveBet>;
}

/**
 * Игровой цикл краша: приём ставок → полёт → краш → пауза → ...
 *
 * ВАЖНО: это синглтон. Два экземпляра crash-service запустили бы два параллельных
 * игровых цикла. Горизонтально так не масштабируют без leader election.
 */
@Injectable()
export class CrashEngine implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Crash');
  private round: Round | null = null;
  private history: Array<{ roundId: number; crashPoint: number }> = [];
  private stopped = false;

  constructor(
    private readonly db: Database,
    private readonly kafka: KafkaPublisher,
  ) {}

  async onApplicationBootstrap() {
    await this.recover();
    const { rows } = await this.db.query(
      `SELECT id, crash_point FROM games.crash_rounds WHERE status = 'crashed' ORDER BY id DESC LIMIT 20`,
    );
    this.history = rows.map((r) => ({ roundId: r.id, crashPoint: r.crash_point }));
    void this.loop();
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  // ================= Kafka: новая ставка =================

  async acceptBet(bet: BetAccepted) {
    const auto = (bet.selection as CrashSelection).autoCashout ?? null;
    const round = this.round;
    const joinNow = round?.phase === 'betting';

    const ins = await this.db.query(
      `INSERT INTO games.crash_bets (bet_id, round_id, player_id, username, amount, auto_cashout, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (bet_id) DO NOTHING`,
      [bet.betId, joinNow ? round!.id : null, bet.playerId, bet.username, bet.amount, auto, joinNow ? 'active' : 'pending'],
    );
    if (!ins.rowCount) return; // повторная доставка

    const autoText = auto ? ` (авто ${auto}x)` : '';
    if (joinNow && round!.phase !== 'crashed') {
      round!.bets.set(bet.betId, { ...this.toLive(bet), autoCashout: auto });
      this.logger.log(`🎟  ${bet.username}: ${bet.amount}${autoText} → раунд #${round!.id}`);
      // Для UI: список игроков раунда обновляется вживую
      await this.publishRound({
        type: 'BET_JOINED',
        roundId: round!.id,
        at: new Date().toISOString(),
        playerId: bet.playerId,
        username: bet.username,
        amount: bet.amount,
        autoCashout: auto,
      });
    } else {
      if (joinNow) {
        await this.db.query(`UPDATE games.crash_bets SET round_id = NULL, status = 'pending' WHERE bet_id = $1`, [bet.betId]);
      }
      // Ставка дошла (через Kafka → wallet → Kafka), когда приём уже закрыт — играет в следующем раунде
      this.logger.log(`🎟  ${bet.username}: ${bet.amount}${autoText} → ждёт следующего раунда`);
    }
  }

  // ================= RabbitMQ RPC =================

  async cashout(playerId: string) {
    const round = this.round;
    if (!round || round.phase !== 'running') {
      throw new RpcException(round?.phase === 'betting' ? 'ROUND_NOT_STARTED' : 'NO_RUNNING_ROUND');
    }
    const m = this.currentMultiplier(round);
    if (m >= round.crashPoint) throw new RpcException('TOO_LATE');

    const bets = [...round.bets.values()].filter((b) => b.playerId === playerId && b.cashedOutAt === null);
    if (!bets.length) throw new RpcException('NO_ACTIVE_BET');

    // Сначала синхронно помечаем (между await'ами может случиться краш), потом рассчитываем
    for (const b of bets) b.cashedOutAt = m;
    await Promise.all(bets.map((b) => this.settleCashout(round.id, b, 'вручную')));

    return {
      roundId: round.id,
      multiplier: m,
      bets: bets.map((b) => ({ betId: b.betId, amount: b.amount, payout: Math.floor(b.amount * m) })),
      note: 'Выигрыш уже ушёл в bets.settled — wallet зачислит его, не дожидаясь краша раунда',
    };
  }

  state() {
    const round = this.round;
    return {
      roundId: round?.id ?? null,
      phase: round?.phase ?? 'idle',
      multiplier: round ? this.currentMultiplier(round) : 1,
      bettingEndsInMs: round?.phase === 'betting' ? Math.max(0, round.bettingEndsAt - Date.now()) : 0,
      // Точку краша показываем только после краша — иначе игра теряет смысл
      crashPoint: round?.phase === 'crashed' ? round.crashPoint : undefined,
      bets: round
        ? [...round.bets.values()].map((b) => ({
            playerId: b.playerId,
            username: b.username,
            amount: b.amount,
            autoCashout: b.autoCashout,
            cashedOutAt: b.cashedOutAt,
          }))
        : [],
      history: this.history.slice(0, 10).map((h) => h.crashPoint),
    };
  }

  // ================= игровой цикл =================

  private async loop() {
    while (!this.stopped) {
      try {
        await this.playRound();
      } catch (e) {
        this.logger.error(`раунд упал: ${(e as Error).message}`);
      }
      await sleep(PAUSE_MS);
    }
  }

  private async playRound() {
    const crashPoint = generateCrashPoint();
    const { rows } = await this.db.query(
      `INSERT INTO games.crash_rounds (status, crash_point) VALUES ('betting', $1) RETURNING id`,
      [crashPoint],
    );
    const round: Round = {
      id: rows[0].id,
      phase: 'betting',
      crashPoint,
      bettingEndsAt: Date.now() + BETTING_MS,
      startedAt: null,
      bets: new Map(),
    };
    this.round = round;

    // Ставки, которые пришли во время прошлого раунда, переходят в этот
    const pending = await this.db.query(
      `UPDATE games.crash_bets SET round_id = $1, status = 'active' WHERE status = 'pending'
       RETURNING bet_id, player_id, username, amount, auto_cashout`,
      [round.id],
    );
    for (const r of pending.rows) {
      round.bets.set(r.bet_id, {
        betId: r.bet_id,
        playerId: r.player_id,
        username: r.username,
        amount: r.amount,
        autoCashout: r.auto_cashout,
        cashedOutAt: null,
      });
    }

    await this.publishRound({
      type: 'BETTING_OPEN',
      roundId: round.id,
      at: new Date().toISOString(),
      bettingMs: BETTING_MS,
      bets: round.bets.size,
    });
    this.logger.log(`🎲 раунд #${round.id}: приём ставок ${BETTING_MS / 1000}с`);
    await sleep(BETTING_MS);
    if (this.stopped) return;

    round.phase = 'running';
    round.startedAt = Date.now();
    await this.db.query(`UPDATE games.crash_rounds SET status = 'running', started_at = now() WHERE id = $1`, [round.id]);
    await this.publishRound({ type: 'STARTED', roundId: round.id, at: new Date().toISOString(), bets: round.bets.size });
    this.logger.log(`🚀 раунд #${round.id} взлетел, ставок: ${round.bets.size}`);

    while (!this.stopped) {
      await sleep(TICK_MS);
      const m = this.currentMultiplier(round);
      for (const bet of round.bets.values()) {
        if (bet.cashedOutAt === null && bet.autoCashout !== null && bet.autoCashout <= m) {
          bet.cashedOutAt = bet.autoCashout;
          await this.settleCashout(round.id, bet, 'авто');
        }
      }
      if (m >= round.crashPoint) break;
    }
    if (this.stopped) return; // раунд останется running → при старте recover() вернёт ставки

    await this.crash(round);
  }

  private async crash(round: Round) {
    round.phase = 'crashed';
    const settledAt = new Date().toISOString();
    let stake = 0;
    let paid = 0;
    let winners = 0;
    for (const b of round.bets.values()) {
      stake += b.amount;
      if (b.cashedOutAt !== null) {
        paid += Math.floor(b.amount * b.cashedOutAt);
        winners++;
      }
    }

    // Забравшие уже рассчитаны в settleCashout — здесь остаются только проигравшие
    const settlements: BetSettled[] = [...round.bets.values()]
      .filter((b) => b.cashedOutAt === null)
      .map((b) => ({
        betId: b.betId,
        playerId: b.playerId,
        username: b.username,
        game: 'crash',
        amount: b.amount,
        payout: 0,
        outcome: 'loss',
        result: { roundId: round.id, crashPoint: round.crashPoint, cashedOutAt: null, autoCashout: b.autoCashout },
        settledAt,
      }));

    // Порядок важен: сначала Kafka, потом БД.
    // Упадём между ними — раунд останется 'running', recover() разошлёт refund,
    // а wallet проигнорирует его, потому что ставка уже settled. Деньги не задвоятся.
    // Если Kafka недоступна — ждём её (игра на паузе), а не бросаем раунд с зависшими ставками.
    await this.untilPublished(`итоги раунда #${round.id}`, () =>
      this.kafka.publishMany(
        TOPICS.BETS_SETTLED,
        settlements.map((s) => ({ key: s.playerId, value: s })),
      ),
    );
    await this.db.tx(async (c) => {
      await c.query(`UPDATE games.crash_rounds SET status = 'crashed', crashed_at = now() WHERE id = $1`, [round.id]);
      for (const s of settlements) {
        await c.query(`UPDATE games.crash_bets SET status = 'lost', payout = 0 WHERE bet_id = $1`, [s.betId]);
      }
    });

    await this.publishRound({
      type: 'CRASHED',
      roundId: round.id,
      at: settledAt,
      crashPoint: round.crashPoint,
      bets: round.bets.size,
      winners,
      stake,
      paid,
    });
    this.history.unshift({ roundId: round.id, crashPoint: round.crashPoint });
    this.history.length = Math.min(this.history.length, 20);
    this.logger.log(
      `💥 раунд #${round.id}: краш на ${round.crashPoint}x | ставок ${round.bets.size}, забрали ${winners} | принято ${stake}, выплачено ${paid}`,
    );
  }

  /** После падения сервиса: незавершённые раунды отменяем, ставки возвращаем */
  private async recover() {
    const rounds = await this.db.query(`SELECT id FROM games.crash_rounds WHERE status IN ('betting', 'running')`);
    for (const { id } of rounds.rows) {
      const bets = await this.db.query(
        `SELECT bet_id, player_id, username, amount FROM games.crash_bets WHERE round_id = $1 AND status = 'active'`,
        [id],
      );
      const settledAt = new Date().toISOString();
      await this.kafka.publishMany(
        TOPICS.BETS_SETTLED,
        bets.rows.map((b): { key: string; value: BetSettled } => ({
          key: b.player_id,
          value: {
            betId: b.bet_id,
            playerId: b.player_id,
            username: b.username,
            game: 'crash',
            amount: b.amount,
            payout: b.amount,
            outcome: 'refund',
            result: { roundId: id, cancelled: true },
            settledAt,
          },
        })),
      );
      await this.db.tx(async (c) => {
        await c.query(`UPDATE games.crash_rounds SET status = 'cancelled', crashed_at = now() WHERE id = $1`, [id]);
        await c.query(`UPDATE games.crash_bets SET status = 'refunded', payout = amount WHERE round_id = $1 AND status = 'active'`, [
          id,
        ]);
      });
      await this.publishRound({ type: 'CANCELLED', roundId: id, at: settledAt, bets: bets.rowCount ?? 0 });
      this.logger.warn(`♻ раунд #${id} не был завершён (сервис падал) — отменён, возвращено ставок: ${bets.rowCount}`);
    }
  }

  private currentMultiplier(round: Round): number {
    if (round.phase === 'betting' || round.startedAt === null) return 1;
    if (round.phase === 'crashed') return round.crashPoint;
    return Math.min(multiplierAt(Date.now() - round.startedAt), round.crashPoint);
  }

  /**
   * Кэшаут — окончательный выигрыш: дальнейший полёт на него уже не влияет.
   * Поэтому рассчитываем ставку сразу, а не после краша — иначе при высоком множителе
   * баланс стоял бы на месте до конца раунда (до ~50 секунд).
   *
   * Тот же порядок, что в crash(): сначала Kafka, потом БД. Упадём между ними — ставка
   * останется 'active', recover() разошлёт refund, а wallet его проигнорирует (ставка уже settled).
   * crashPoint в result не кладём: раунд ещё летит, а события ставок уходят в браузер.
   */
  private async settleCashout(roundId: number, bet: LiveBet, how: string) {
    const payout = Math.floor(bet.amount * bet.cashedOutAt!);
    const settled: BetSettled = {
      betId: bet.betId,
      playerId: bet.playerId,
      username: bet.username,
      game: 'crash',
      amount: bet.amount,
      payout,
      outcome: 'win',
      result: { roundId, cashedOutAt: bet.cashedOutAt, autoCashout: bet.autoCashout },
      settledAt: new Date().toISOString(),
    };
    await this.untilPublished(`кэшаут ${bet.username}`, () =>
      this.kafka.publishMany(TOPICS.BETS_SETTLED, [{ key: bet.playerId, value: settled }]),
    );
    await this.db.query(`UPDATE games.crash_bets SET cashed_out_at = $2, status = 'won', payout = $3 WHERE bet_id = $1`, [
      bet.betId,
      bet.cashedOutAt,
      payout,
    ]);
    this.logger.log(`💸 ${bet.username} забрал на ${bet.cashedOutAt}x (${how}) → ${payout}`);
    await this.publishRound({
      type: 'CASHOUT',
      roundId,
      at: new Date().toISOString(),
      playerId: bet.playerId,
      username: bet.username,
      amount: bet.amount,
      multiplier: bet.cashedOutAt!,
      payout,
    });
  }

  /** Информационное событие: если Kafka недоступна — не роняем из-за него игру */
  private async publishRound(e: CrashRoundEvent) {
    try {
      // Ключ одинаковый → одна партиция → события раундов строго по порядку
      await this.kafka.publish(TOPICS.CRASH_ROUNDS, 'crash', e);
    } catch (err) {
      this.logger.warn(`crash.rounds ${e.type} #${e.roundId} не опубликован: ${(err as Error).message}`);
    }
  }

  /** Повторять публикацию, пока Kafka не примет. Если сервис останавливают — сдаёмся, остальное сделает recover() */
  private async untilPublished(what: string, publish: () => Promise<void>) {
    for (let attempt = 1; ; attempt++) {
      try {
        await publish();
        if (attempt > 1) this.logger.log(`${what}: опубликовано с попытки ${attempt}`);
        return;
      } catch (err) {
        if (this.stopped) throw err;
        this.logger.warn(`${what}: Kafka недоступна (${(err as Error).message}), повтор через 2с`);
        await sleep(2_000);
      }
    }
  }

  private toLive(bet: BetAccepted): LiveBet {
    return {
      betId: bet.betId,
      playerId: bet.playerId,
      username: bet.username,
      amount: bet.amount,
      autoCashout: null,
      cashedOutAt: null,
    };
  }
}
