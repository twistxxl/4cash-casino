import type { Options } from 'amqplib';

// =====================================================================
//  KAFKA — журнал событий. Ключ сообщения почти везде = playerId:
//  все события одного игрока попадают в одну партицию → порядок сохраняется.
// =====================================================================
export const TOPICS = {
  /** gateway → wallet, risk. Игрок хочет сделать ставку */
  BETS_PLACED: 'bets.placed',
  /** wallet → roulette, crash. Деньги списаны, ставку можно играть */
  BETS_ACCEPTED: 'bets.accepted',
  /** wallet → (никто, смотреть в UI). Не хватило денег / игрок заблокирован */
  BETS_REJECTED: 'bets.rejected',
  /** roulette, crash → wallet, leaderboard, risk. Итог ставки */
  BETS_SETTLED: 'bets.settled',
  /** wallet → risk. Каждое движение денег (депозит, ставка, выигрыш, вывод) */
  WALLET_TRANSACTIONS: 'wallet.transactions',
  /** risk → wallet. Подозрительная активность (иногда с блокировкой) */
  RISK_ALERTS: 'risk.alerts',
  /** crash → leaderboard. Жизненный цикл раундов краша */
  CRASH_ROUNDS: 'crash.rounds',
  /** gateway ↔ leaderboard. Request-reply поверх Kafka (ответ в leaderboard.get.reply) */
  LEADERBOARD_GET: 'leaderboard.get',
} as const;

/** Все топики создаются скриптом setup. Партиций по 3 у "игроковых" топиков —
 *  одинаковое число важно: risk-service джойнит несколько топиков по ключу (co-partitioning). */
export const TOPIC_DEFINITIONS = [
  { topic: TOPICS.BETS_PLACED, numPartitions: 3 },
  { topic: TOPICS.BETS_ACCEPTED, numPartitions: 3 },
  { topic: TOPICS.BETS_REJECTED, numPartitions: 3 },
  { topic: TOPICS.BETS_SETTLED, numPartitions: 3 },
  { topic: TOPICS.WALLET_TRANSACTIONS, numPartitions: 3 },
  { topic: TOPICS.RISK_ALERTS, numPartitions: 3 },
  { topic: TOPICS.CRASH_ROUNDS, numPartitions: 1 },
  { topic: TOPICS.LEADERBOARD_GET, numPartitions: 1 },
  { topic: `${TOPICS.LEADERBOARD_GET}.reply`, numPartitions: 1 },
];

// =====================================================================
//  RABBITMQ — очереди задач и команд
// =====================================================================
export const QUEUES = {
  /** RPC: gateway → wallet (баланс, депозит, вывод...) */
  WALLET_RPC: 'wallet.rpc',
  /** RPC: gateway → crash (состояние раунда, кэшаут) */
  CRASH_RPC: 'crash.rpc',
  /** Задачи на выплату: wallet → payments */
  PAYOUTS: 'payouts',
  /** Отложенный повтор: сообщение лежит TTL и возвращается в payouts */
  PAYOUTS_RETRY: 'payouts.retry',
  /** Выплаты, которые не прошли за MAX_PAYOUT_ATTEMPTS попыток */
  PAYOUTS_DLQ: 'payouts.dlq',
  /** Результаты выплат: payments → wallet */
  PAYOUT_RESULTS: 'payouts.results',
  NOTIFY_PUSH: 'notifications.push',
  NOTIFY_EMAIL: 'notifications.email',
  NOTIFY_ADMIN: 'notifications.admin',
  /** Получает копию ВСЕХ уведомлений (binding "#"), никто не читает — смотреть в UI */
  NOTIFY_AUDIT: 'notifications.audit',
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

/** Topic exchange: routing key вида "<канал>.<событие>", например push.big_win */
export const NOTIFICATIONS_EXCHANGE = 'notifications';
export const NOTIFICATION_BINDINGS: Array<[QueueName, string]> = [
  [QUEUES.NOTIFY_PUSH, 'push.*'],
  [QUEUES.NOTIFY_EMAIL, 'email.*'],
  [QUEUES.NOTIFY_ADMIN, 'admin.*'],
  [QUEUES.NOTIFY_AUDIT, '#'],
];

export const PAYOUT_RETRY_DELAY_MS = 5_000;
export const MAX_PAYOUT_ATTEMPTS = 3;

/**
 * Параметры очереди должны совпадать у ВСЕХ, кто её объявляет (setup, Nest-клиент, Nest-сервер),
 * иначе RabbitMQ закроет канал с PRECONDITION_FAILED. Поэтому они в одном месте.
 */
export const QUEUE_OPTIONS: Record<QueueName, Options.AssertQueue> = {
  [QUEUES.WALLET_RPC]: { durable: true },
  [QUEUES.CRASH_RPC]: { durable: true },
  [QUEUES.PAYOUTS]: {
    durable: true,
    arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': QUEUES.PAYOUTS_DLQ },
  },
  [QUEUES.PAYOUTS_RETRY]: {
    durable: true,
    arguments: {
      'x-message-ttl': PAYOUT_RETRY_DELAY_MS,
      // когда TTL истёк — сообщение "умирает" и через default exchange возвращается в payouts
      'x-dead-letter-exchange': '',
      'x-dead-letter-routing-key': QUEUES.PAYOUTS,
    },
  },
  [QUEUES.PAYOUTS_DLQ]: { durable: true },
  [QUEUES.PAYOUT_RESULTS]: { durable: true },
  [QUEUES.NOTIFY_PUSH]: { durable: true },
  [QUEUES.NOTIFY_EMAIL]: { durable: true },
  [QUEUES.NOTIFY_ADMIN]: { durable: true },
  [QUEUES.NOTIFY_AUDIT]: { durable: true, arguments: { 'x-max-length': 500 } },
};

/** Nest-формат RMQ-сообщения: { pattern, data }. pattern выбирает обработчик. */
export const RMQ_PATTERNS = {
  WALLET_REGISTER: 'wallet.register',
  WALLET_LIST_PLAYERS: 'wallet.list-players',
  WALLET_GET_PLAYER: 'wallet.get-player',
  WALLET_DEPOSIT: 'wallet.deposit',
  WALLET_WITHDRAW: 'wallet.withdraw',
  WALLET_UNBLOCK: 'wallet.unblock',
  WALLET_GET_BET: 'wallet.get-bet',
  WALLET_PLAYER_BETS: 'wallet.player-bets',
  WALLET_RECENT_BETS: 'wallet.recent-bets',
  CRASH_STATE: 'crash.state',
  CRASH_CASHOUT: 'crash.cashout',
  PAYOUT_PROCESS: 'payout.process',
  PAYOUT_RESULT: 'payout.result',
  NOTIFY: 'notify',
} as const;

// DI-токены клиентов
export const WALLET_RPC_CLIENT = 'WALLET_RPC_CLIENT';
export const CRASH_RPC_CLIENT = 'CRASH_RPC_CLIENT';
export const KAFKA_RPC_CLIENT = 'KAFKA_RPC_CLIENT';
