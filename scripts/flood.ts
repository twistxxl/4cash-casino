/**
 * Залить в Kafka пачку ставок НАПРЯМУЮ через kafkajs (мимо gateway).
 * Нужен для уроков про consumer lag, партиции и формат сообщений.
 *
 *   pnpm flood                 # 2000 ставок по 1 фишке
 *   pnpm flood bets=10000
 *   pnpm flood bets=2000 burst=1
 *
 * placedAt (event time) по умолчанию "растянут" в прошлое — 1 ставка в 2 секунды на игрока,
 * поэтому антифрод (он считает по event time) не видит в этом ботов.
 * burst=1 — все ставки с текущим временем: risk-service решит, что все игроки — боты, и заблокирует их.
 * (Разблокировать: POST /players/:id/unblock, или заново pnpm seed)
 */
import { randomUUID } from 'crypto';
import { Kafka, logLevel, Partitioners } from 'kafkajs';
import { Client } from 'pg';
import { BetPlaced, config, TOPICS } from '@app/common';
import { arg, pick } from './personas';

const BETS = arg('bets', 2_000);
const BURST = arg('burst', 0) === 1;
const BATCH = 500;
/** Интервал event time между ставками одного игрока: 2с → ~5 ставок в 10-секундном окне антифрода */
const SPACING_MS = 2_000;

(async () => {
  const db = new Client({ connectionString: config.databaseUrl });
  await db.connect();
  const { rows: players } = await db.query(
    `SELECT id FROM wallet.players WHERE status = 'active' AND persona <> 'demo' AND balance > 50`,
  );
  await db.end();
  if (!players.length) throw new Error('Нет активных игроков с балансом — pnpm seed');

  // Раскидываем ставки по игрокам и считаем, сколько у кого — чтобы растянуть event time
  const plan = Array.from({ length: BETS }, () => pick(players).id as string);
  const perPlayer = new Map<string, number>();
  plan.forEach((id) => perPlayer.set(id, (perPlayer.get(id) ?? 0) + 1));
  const seq = new Map<string, number>();
  const now = Date.now();

  const messages = plan.map((playerId) => {
    const k = seq.get(playerId) ?? 0;
    seq.set(playerId, k + 1);
    const placedAt = BURST ? new Date() : new Date(now - (perPlayer.get(playerId)! - k) * SPACING_MS);
    const bet: BetPlaced = {
      betId: randomUUID(),
      playerId,
      game: 'roulette',
      amount: 1,
      selection: { type: pick(['red', 'black'] as const) },
      placedAt: placedAt.toISOString(),
    };
    // Вот так сообщение выглядит "на проводе": key — строка, value — JSON-строка.
    // Nest-консьюмер сам распарсит value и передаст объект в @Payload().
    return { key: playerId, value: JSON.stringify(bet) };
  });

  const producer = new Kafka({ clientId: 'flood', brokers: config.kafkaBrokers, logLevel: logLevel.WARN }).producer({
    createPartitioner: Partitioners.DefaultPartitioner,
  });
  await producer.connect();

  const started = Date.now();
  for (let i = 0; i < messages.length; i += BATCH) {
    await producer.send({ topic: TOPICS.BETS_PLACED, messages: messages.slice(i, i + BATCH) });
  }
  await producer.disconnect();

  console.log(`🌊 ${BETS} ставок → "${TOPICS.BETS_PLACED}" за ${Date.now() - started} мс, игроков: ${perPlayer.size}${BURST ? ' (burst!)' : ''}`);
  console.log('Пример сообщения:', messages[0]);
  console.log('\nТеперь открой Kafka UI → Consumers и посмотри lag у wallet-service-server и risk-service-server');
})().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
