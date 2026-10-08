/**
 * Создаёт всю инфраструктуру. Идемпотентно — можно запускать сколько угодно раз.
 *   PostgreSQL: схемы wallet / games / risk и таблицы
 *   Kafka:      топики с нужным числом партиций
 *   RabbitMQ:   очереди (с DLX/TTL), topic exchange уведомлений и его bindings
 *
 * Написано на "голых" pg / kafkajs / amqplib, без Nest.
 */
import { Kafka, logLevel } from 'kafkajs';
import * as amqp from 'amqplib';
import { Client } from 'pg';
import {
  config,
  NOTIFICATION_BINDINGS,
  NOTIFICATIONS_EXCHANGE,
  QUEUE_OPTIONS,
  QueueName,
  SCHEMA_SQL,
  sleep,
  TOPIC_DEFINITIONS,
} from '@app/common';

async function retry<T>(label: string, fn: () => Promise<T>, attempts = 30): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= attempts) throw e;
      if (i === 1) console.log(`⏳ жду ${label}...`);
      await sleep(2_000);
    }
  }
}

async function setupPostgres() {
  await retry('PostgreSQL', async () => {
    const client = new Client({ connectionString: config.databaseUrl });
    await client.connect();
    try {
      await client.query(SCHEMA_SQL);
    } finally {
      await client.end();
    }
  });
  console.log('✅ PostgreSQL: схемы wallet, games, risk готовы');
}

async function setupKafka() {
  const admin = new Kafka({ clientId: 'setup', brokers: config.kafkaBrokers, logLevel: logLevel.NOTHING }).admin();
  await retry('Kafka', () => admin.connect());
  const existing = await admin.listTopics();
  const missing = TOPIC_DEFINITIONS.filter((t) => !existing.includes(t.topic));
  if (missing.length) {
    await admin.createTopics({ topics: missing.map((t) => ({ ...t, replicationFactor: 1 })), waitForLeaders: true });
  }
  const meta = await admin.fetchTopicMetadata({ topics: TOPIC_DEFINITIONS.map((t) => t.topic) });
  console.log(`✅ Kafka: создано топиков ${missing.length}`);
  console.table(meta.topics.map((t) => ({ topic: t.name, partitions: t.partitions.length })));
  await admin.disconnect();
}

async function setupRabbit() {
  const conn = await retry('RabbitMQ', () => amqp.connect(config.rabbitUrl));
  const ch = await conn.createChannel();

  for (const [queue, options] of Object.entries(QUEUE_OPTIONS) as Array<[QueueName, amqp.Options.AssertQueue]>) {
    await ch.assertQueue(queue, options);
  }
  await ch.assertExchange(NOTIFICATIONS_EXCHANGE, 'topic', { durable: true });
  for (const [queue, pattern] of NOTIFICATION_BINDINGS) {
    await ch.bindQueue(queue, NOTIFICATIONS_EXCHANGE, pattern);
  }
  console.log(`✅ RabbitMQ: очередей ${Object.keys(QUEUE_OPTIONS).length}, exchange "${NOTIFICATIONS_EXCHANGE}" (topic):`);
  console.table(NOTIFICATION_BINDINGS.map(([queue, pattern]) => ({ 'routing key': pattern, '→ queue': queue })));
  await conn.close();
}

(async () => {
  await setupPostgres();
  await setupKafka();
  await setupRabbit();
  console.log('\nДальше: pnpm seed → pnpm dev → pnpm simulate');
})().catch((e) => {
  console.error('\n❌ Setup упал. Инфраструктура поднята? (pnpm infra:up)\n', e);
  process.exit(1);
});
