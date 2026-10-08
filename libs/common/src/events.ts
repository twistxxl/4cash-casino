// Контракты сообщений. Деньги — целые фишки (chips), без копеек и float.

export type GameType = 'roulette' | 'crash';

export type RouletteSelection =
  | { type: 'straight'; number: number } // одно число, 35:1
  | { type: 'dozen'; dozen: 1 | 2 | 3 } //   12 чисел, 2:1
  | { type: 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' }; // 1:1

export interface CrashSelection {
  /** Автоматически забрать на этом множителе. Без него — только ручной кэшаут */
  autoCashout?: number;
}

export type BetSelection = RouletteSelection | CrashSelection;

/** bets.placed */
export interface BetPlaced {
  betId: string;
  playerId: string;
  game: GameType;
  amount: number;
  selection: BetSelection;
  placedAt: string;
}

/** bets.accepted — wallet обогащает событие (event-carried state transfer) */
export interface BetAccepted extends BetPlaced {
  username: string;
  balanceAfter: number;
}

export type RejectReason = 'PLAYER_NOT_FOUND' | 'PLAYER_BLOCKED' | 'INSUFFICIENT_FUNDS' | 'INVALID_AMOUNT';

/** bets.rejected */
export interface BetRejected extends BetPlaced {
  reason: RejectReason;
}

export type BetOutcome = 'win' | 'loss' | 'refund';

/** bets.settled */
export interface BetSettled {
  betId: string;
  playerId: string;
  username: string;
  game: GameType;
  amount: number;
  /** Сколько вернуть игроку (включая ставку). 0 — проигрыш */
  payout: number;
  outcome: BetOutcome;
  /** Детали игры: число на рулетке / точка краша и множитель кэшаута */
  result: Record<string, unknown>;
  settledAt: string;
}

export type TransactionType = 'deposit' | 'bet' | 'win' | 'refund' | 'withdrawal' | 'withdrawal_refund';

/** wallet.transactions */
export interface WalletTransaction {
  txId: string;
  playerId: string;
  username: string;
  type: TransactionType;
  /** со знаком: + зачисление, − списание */
  amount: number;
  balanceAfter: number;
  refId: string;
  createdAt: string;
}

export type RiskRule = 'HIGH_FREQUENCY' | 'BIG_WIN' | 'MARTINGALE' | 'DEPOSIT_WITHDRAW';

/** risk.alerts */
export interface RiskAlert {
  alertId: string;
  playerId: string;
  username: string;
  rule: RiskRule;
  severity: 'low' | 'medium' | 'high';
  action: 'NONE' | 'BLOCK_PLAYER';
  details: Record<string, unknown>;
  detectedAt: string;
}

/** crash.rounds */
export interface CrashRoundEvent {
  type: 'BETTING_OPEN' | 'STARTED' | 'CRASHED' | 'CANCELLED' | 'BET_JOINED' | 'CASHOUT';
  roundId: number;
  at: string;
  /** BETTING_OPEN: сколько длится приём ставок */
  bettingMs?: number;
  crashPoint?: number;
  bets?: number;
  winners?: number;
  stake?: number;
  paid?: number;
  /** BET_JOINED / CASHOUT: чья ставка */
  playerId?: string;
  username?: string;
  amount?: number;
  autoCashout?: number | null;
  /** CASHOUT: на каком множителе забрали и сколько */
  multiplier?: number;
  payout?: number;
}

/** RabbitMQ: payouts */
export interface PayoutTask {
  withdrawalId: string;
  playerId: string;
  username: string;
  amount: number;
  attempt: number;
}

/** RabbitMQ: payouts.results */
export interface PayoutResult {
  withdrawalId: string;
  status: 'completed' | 'failed';
  reason?: string;
  providerRef?: string;
}

/** RabbitMQ: exchange notifications */
export interface NotificationMessage {
  playerId?: string;
  username?: string;
  text: string;
  meta?: Record<string, unknown>;
}
