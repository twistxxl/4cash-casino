import { Controller, Logger } from '@nestjs/common';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import { BetSettled, CrashRoundEvent, GameType, TOPICS } from '@app/common';

interface PlayerStats {
  username: string;
  bets: number;
  wagered: number;
  paid: number;
  biggestWin: number;
}

const REPORT_EVERY = 100;

/**
 * Проекция (read model), построенная ТОЛЬКО из событий Kafka. Хранится в памяти.
 * Перезапустил сервис — всё пропало? Нет: новая consumer group с fromBeginning
 * перечитает историю и восстановит те же цифры. Это и есть replay.
 */
@Controller()
export class LeaderboardController {
  private readonly logger = new Logger('Leaderboard');
  private readonly players = new Map<string, PlayerStats>();
  private readonly games: Record<GameType, { bets: number; wagered: number; paid: number }> = {
    roulette: { bets: 0, wagered: 0, paid: 0 },
    crash: { bets: 0, wagered: 0, paid: 0 },
  };
  private biggestWins: Array<{ username: string; game: string; amount: number; payout: number; result: unknown }> = [];
  private crashPoints: number[] = [];
  private roundsCancelled = 0;
  /** Защита от дублей: at-least-once доставка может принести одно событие дважды */
  private readonly seen = new Set<string>();
  private duplicates = 0;
  private processed = 0;

  @EventPattern(TOPICS.BETS_SETTLED)
  onBetSettled(@Payload() e: BetSettled) {
    if (e.outcome === 'refund') return;
    if (this.seen.has(e.betId)) {
      this.duplicates++;
      return;
    }
    this.seen.add(e.betId);

    const p = this.players.get(e.playerId) ?? { username: e.username, bets: 0, wagered: 0, paid: 0, biggestWin: 0 };
    p.bets++;
    p.wagered += e.amount;
    p.paid += e.payout;
    p.biggestWin = Math.max(p.biggestWin, e.payout - e.amount);
    this.players.set(e.playerId, p);

    const g = this.games[e.game];
    g.bets++;
    g.wagered += e.amount;
    g.paid += e.payout;

    if (e.payout > e.amount) {
      this.biggestWins.push({ username: e.username, game: e.game, amount: e.amount, payout: e.payout, result: e.result });
      this.biggestWins = this.biggestWins.sort((a, b) => b.payout - b.amount - (a.payout - a.amount)).slice(0, 5);
    }

    if (++this.processed % REPORT_EVERY === 0) this.report();
  }

  @EventPattern(TOPICS.CRASH_ROUNDS)
  onCrashRound(@Payload() e: CrashRoundEvent) {
    if (e.type === 'CRASHED' && e.crashPoint !== undefined) {
      this.crashPoints.push(e.crashPoint);
      if (this.crashPoints.length > 500) this.crashPoints.shift();
    }
    if (e.type === 'CANCELLED') this.roundsCancelled++;
  }

  /** Request-reply поверх Kafka: gateway шлёт в leaderboard.get, ответ уходит в leaderboard.get.reply */
  @MessagePattern(TOPICS.LEADERBOARD_GET)
  snapshot() {
    const rows = [...this.players.entries()].map(([playerId, p]) => ({ playerId, ...p, net: p.paid - p.wagered }));
    const games = Object.fromEntries(
      Object.entries(this.games).map(([name, g]) => [
        name,
        {
          ...g,
          // RTP — сколько процентов ставок вернулось игрокам. GGR — доход казино
          rtp: g.wagered ? `${((g.paid / g.wagered) * 100).toFixed(2)}%` : '—',
          ggr: g.wagered - g.paid,
        },
      ]),
    );
    const cp = this.crashPoints;
    return {
      processedBets: this.processed,
      duplicatesSkipped: this.duplicates,
      topWinners: [...rows].sort((a, b) => b.net - a.net).slice(0, 10),
      topLosers: [...rows].sort((a, b) => a.net - b.net).slice(0, 5),
      biggestWins: this.biggestWins,
      games,
      crash: {
        rounds: cp.length,
        cancelled: this.roundsCancelled,
        last: cp.slice(-15).reverse(),
        median: cp.length ? [...cp].sort((a, b) => a - b)[Math.floor(cp.length / 2)] : null,
        instantCrashes: cp.filter((x) => x === 1).length,
      },
    };
  }

  private report() {
    const top = [...this.players.values()]
      .map((p) => ({ u: p.username, net: p.paid - p.wagered }))
      .sort((a, b) => b.net - a.net)
      .slice(0, 3)
      .map((p) => `${p.u} ${p.net >= 0 ? '+' : ''}${p.net}`)
      .join(', ');
    const rtp = (g: { wagered: number; paid: number }) => (g.wagered ? ((g.paid / g.wagered) * 100).toFixed(1) + '%' : '—');
    this.logger.log(
      `🏆 ставок ${this.processed} | RTP рулетка ${rtp(this.games.roulette)}, краш ${rtp(this.games.crash)} | топ: ${top}`,
    );
  }
}
