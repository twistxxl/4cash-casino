import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Database, KafkaPublisher, RabbitPublisher } from '@app/common';

const INTERVAL_MS = Number(process.env.OUTBOX_INTERVAL_MS ?? 100);
const BATCH_SIZE = 500;
const REPORT_EVERY_MS = 10_000;

/**
 * Transactional outbox relay.
 *
 * Проблема: "списать деньги в БД" и "отправить событие в Kafka" — две разные системы.
 * Если упасть между ними, получим списанные деньги без события (или наоборот).
 * Решение: событие пишется в таблицу wallet.outbox в той же транзакции, что и деньги,
 * а этот relay периодически вычитывает неопубликованные строки и шлёт их в брокеры.
 *
 * Гарантия — at-least-once: если упасть после отправки, но до UPDATE published_at,
 * событие уйдёт повторно. Поэтому все консьюмеры идемпотентны.
 */
@Injectable()
export class OutboxRelay implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Outbox');
  private timer?: NodeJS.Timeout;
  private reportTimer?: NodeJS.Timeout;
  private busy = false;
  private stats = { kafka: 0, rabbit: 0 };

  constructor(
    private readonly db: Database,
    private readonly kafka: KafkaPublisher,
    private readonly rabbit: RabbitPublisher,
  ) {}

  onApplicationBootstrap() {
    this.timer = setInterval(() => void this.flush(), INTERVAL_MS);
    this.reportTimer = setInterval(() => this.report(), REPORT_EVERY_MS);
  }

  onModuleDestroy() {
    clearInterval(this.timer);
    clearInterval(this.reportTimer);
  }

  private async flush() {
    if (this.busy) return;
    this.busy = true;
    try {
      await this.db.tx(async (c) => {
        // SKIP LOCKED: если запущено несколько wallet-service, они не будут хватать одни и те же строки
        const { rows } = await c.query(
          `SELECT id, destination, target, key, payload FROM wallet.outbox
           WHERE published_at IS NULL ORDER BY id LIMIT ${BATCH_SIZE} FOR UPDATE SKIP LOCKED`,
        );
        if (!rows.length) return;

        // Kafka: группируем по топику с сохранением порядка внутри топика
        // (порядок между разными топиками Kafka всё равно не гарантирует)
        const byTopic = new Map<string, Array<{ key: string; value: unknown }>>();
        for (const r of rows.filter((r) => r.destination === 'kafka')) {
          if (!byTopic.has(r.target)) byTopic.set(r.target, []);
          byTopic.get(r.target)!.push({ key: r.key, value: r.payload });
        }
        for (const [topic, messages] of byTopic) {
          await this.kafka.publishMany(topic, messages);
          this.stats.kafka += messages.length;
        }

        for (const r of rows.filter((r) => r.destination === 'rabbit')) {
          await this.rabbit.publish(r.target, r.key, r.payload.pattern, r.payload.data);
          this.stats.rabbit++;
        }

        await c.query(`UPDATE wallet.outbox SET published_at = now() WHERE id = ANY($1::bigint[])`, [
          rows.map((r) => r.id),
        ]);
      });
    } catch (e) {
      this.logger.error(`публикация не удалась, повторю: ${(e as Error).message}`);
    } finally {
      this.busy = false;
    }
  }

  private report() {
    if (!this.stats.kafka && !this.stats.rabbit) return;
    this.logger.log(`📤 за ${REPORT_EVERY_MS / 1000}с опубликовано: Kafka ${this.stats.kafka}, RabbitMQ ${this.stats.rabbit}`);
    this.stats = { kafka: 0, rabbit: 0 };
  }
}
