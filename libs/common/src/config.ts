// 127.0.0.1 вместо localhost: на Windows localhost может резолвиться в IPv6 (::1),
// а Docker на нём отвечает EACCES.
export const config = {
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? '127.0.0.1:9092').split(','),
  rabbitUrl: process.env.RABBIT_URL ?? 'amqp://guest:guest@127.0.0.1:5672',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://fourcash:fourcash@127.0.0.1:5433/fourcash',
  gatewayUrl: process.env.GATEWAY_URL ?? 'http://127.0.0.1:3000',
};

/** Чистый выигрыш (payout - ставка), начиная с которого это "крупный выигрыш" */
export const BIG_WIN_THRESHOLD = 5_000;

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
