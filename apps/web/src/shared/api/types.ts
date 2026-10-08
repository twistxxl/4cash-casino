// Контракт HTTP API gateway. Фронт зависит от API, а не от внутренних событий Kafka,
// поэтому типы здесь свои, а не импортируются из libs/common.

export type GameType = 'roulette' | 'crash';
export type PlayerStatus = 'active' | 'blocked';
export type Persona = 'demo' | 'casual' | 'regular' | 'highroller' | 'martingale' | 'crash_lover' | 'bot' | 'bonus_abuser';

export type RouletteSelection =
  | { type: 'straight'; number: number }
  | { type: 'dozen'; dozen: 1 | 2 | 3 }
  | { type: 'red' | 'black' | 'even' | 'odd' | 'low' | 'high' };

export interface PlayerSummary {
  id: string;
  username: string;
  persona: Persona | null;
  status: PlayerStatus;
  balance: number;
}

export type TransactionType = 'deposit' | 'bet' | 'win' | 'refund' | 'withdrawal' | 'withdrawal_refund';

export interface Transaction {
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  refId: string;
  createdAt: string;
}

export type WithdrawalStatus = 'pending' | 'completed' | 'failed';

export interface Withdrawal {
  id: string;
  amount: number;
  status: WithdrawalStatus;
  reason: string | null;
  createdAt: string;
}

export interface PlayerDetails extends PlayerSummary {
  email: string;
  country: string;
  createdAt: string;
  stats: { bets: number; wagered: number; paid: number; net: number };
  recentTransactions: Transaction[];
  withdrawals: Withdrawal[];
}

export type BetStatus = 'accepted' | 'rejected' | 'settled' | 'unknown';
export type BetOutcome = 'win' | 'loss' | 'refund';

export interface RouletteResult {
  number: number;
  color: 'red' | 'black' | 'green';
  selection: RouletteSelection;
}

export interface CrashResult {
  roundId: number;
  crashPoint?: number;
  cashedOutAt?: number | null;
  autoCashout?: number | null;
  cancelled?: boolean;
}

export interface Bet {
  betId: string;
  game: GameType;
  amount: number;
  selection: RouletteSelection | { autoCashout?: number };
  status: BetStatus;
  rejectReason: string | null;
  outcome: BetOutcome | null;
  payout: number | null;
  result: RouletteResult | CrashResult | null;
  placedAt: string;
  settledAt: string | null;
}

/** Ставка в ленте (из GET /bets и SSE feed) */
export interface FeedBet {
  betId: string;
  playerId: string;
  username: string;
  game: GameType;
  amount: number;
  payout: number;
  outcome: BetOutcome;
  result: RouletteResult | CrashResult;
  settledAt: string;
}

export interface PlaceBetResponse {
  betId: string;
  status: 'placed';
}

export type CrashPhase = 'betting' | 'running' | 'crashed' | 'idle';

export interface CrashRoundBet {
  playerId: string;
  username: string;
  amount: number;
  autoCashout: number | null;
  cashedOutAt: number | null;
}

export interface CrashState {
  roundId: number | null;
  phase: CrashPhase;
  multiplier: number;
  bettingEndsInMs: number;
  crashPoint?: number;
  bets: CrashRoundBet[];
  history: number[];
}

export interface CashoutResponse {
  roundId: number;
  multiplier: number;
  bets: Array<{ betId: string; amount: number; payout: number }>;
}

export interface LeaderboardRow {
  playerId: string;
  username: string;
  bets: number;
  wagered: number;
  paid: number;
  net: number;
  biggestWin: number;
}

export interface Leaderboard {
  processedBets: number;
  duplicatesSkipped: number;
  topWinners: LeaderboardRow[];
  topLosers: LeaderboardRow[];
  biggestWins: Array<{ username: string; game: GameType; amount: number; payout: number }>;
  games: Record<GameType, { bets: number; wagered: number; paid: number; rtp: string; ggr: number }>;
  crash: { rounds: number; cancelled: number; last: number[]; median: number | null; instantCrashes: number };
  error?: string;
}

// ---------- события SSE (GET /events/stream) ----------

export interface CrashRoundEvent {
  type: 'BETTING_OPEN' | 'STARTED' | 'CRASHED' | 'CANCELLED' | 'BET_JOINED' | 'CASHOUT';
  roundId: number;
  at: string;
  bettingMs?: number;
  crashPoint?: number;
  bets?: number;
  playerId?: string;
  username?: string;
  amount?: number;
  autoCashout?: number | null;
  multiplier?: number;
  payout?: number;
}

export interface BetSettledEvent extends FeedBet {}

export interface BetRejectedEvent {
  betId: string;
  playerId: string;
  game: GameType;
  amount: number;
  reason: string;
}

export interface TransactionEvent extends Transaction {
  txId: string;
  playerId: string;
  username: string;
}

export interface RiskAlertEvent {
  alertId: string;
  playerId: string;
  username: string;
  rule: 'HIGH_FREQUENCY' | 'BIG_WIN' | 'MARTINGALE' | 'DEPOSIT_WITHDRAW';
  severity: 'low' | 'medium' | 'high';
  action: 'NONE' | 'BLOCK_PLAYER';
}

export interface NotificationEvent {
  routingKey: string;
  playerId: string;
  username: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface StreamHandlers {
  crash?: (e: CrashRoundEvent) => void;
  feed?: (bets: FeedBet[]) => void;
  bet?: (e: BetSettledEvent) => void;
  rejected?: (e: BetRejectedEvent) => void;
  tx?: (e: TransactionEvent) => void;
  alert?: (e: RiskAlertEvent) => void;
  notification?: (e: NotificationEvent) => void;
}
