import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AmqpConnectionManager, ChannelWrapper, connect } from 'amqp-connection-manager';
import type { ConsumeMessage } from 'amqplib';
import { randomUUID } from 'crypto';
import { Consumer, Kafka, logLevel } from 'kafkajs';
import { Subject } from 'rxjs';
import { config, NOTIFICATIONS_EXCHANGE, sleep, TOPICS } from '@app/common';

export type StreamEventType = 'crash' | 'bet' | 'rejected' | 'tx' | 'alert' | 'notification';

export interface StreamEvent {
  type: StreamEventType;
  data: object;
  /** Событие конкретного игрока — уйдёт только в его SSE-поток. Без playerId — всем */
  playerId?: string;
}

const TOPIC_TO_TYPE: Record<string, StreamEventType> = {
  [TOPICS.CRASH_ROUNDS]: 'crash',
  [TOPICS.BETS_SETTLED]: 'bet',
  [TOPICS.BETS_REJECTED]: 'rejected',
  [TOPICS.WALLET_TRANSACTIONS]: 'tx',
  [TOPICS.RISK_ALERTS]: 'alert',
};

/**
 * Мост "брокеры → браузер" для SSE.
 *
 * Kafka: у каждого экземпляра gateway СВОЯ consumer group со случайным именем.
 *   Обычная группа поделила бы партиции между экземплярами, и браузер, подключённый
 *   к одному из них, видел бы только часть событий. Здесь нужен broadcast: всё — всем.
 *
 * RabbitMQ: эфемерная очередь (exclusive + auto-delete), привязанная к exchange
 *   notifications по "#". Живёт, пока жив gateway, и получает копию каждого уведомления.
 */
@Injectable()
export class EventStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('EventStream');
  readonly events$ = new Subject<StreamEvent>();
  private consumer?: Consumer;
  private rabbit?: AmqpConnectionManager;
  private channel?: ChannelWrapper;
  private stopped = false;

  onModuleInit() {
    // Не ждём брокеры: HTTP API должен подняться, даже если Kafka ещё стартует
    void this.runKafka();
    this.runRabbit();
  }

  async onModuleDestroy() {
    this.stopped = true;
    await this.consumer?.disconnect().catch(() => undefined);
    await this.channel?.close().catch(() => undefined);
    await this.rabbit?.close().catch(() => undefined);
  }

  private async runKafka() {
    while (!this.stopped) {
      try {
        const kafka = new Kafka({ clientId: `gateway-stream-${process.pid}`, brokers: config.kafkaBrokers, logLevel: logLevel.NOTHING });
        const consumer = kafka.consumer({ groupId: `gateway-stream-${randomUUID().slice(0, 8)}` });
        this.consumer = consumer;
        const crashed = new Promise<void>((resolve) =>
          consumer.on(consumer.events.CRASH, ({ payload }) => {
            if (!payload.restart) resolve();
          }),
        );

        await consumer.connect();
        await consumer.subscribe({ topics: Object.keys(TOPIC_TO_TYPE), fromBeginning: false });
        await consumer.run({
          eachMessage: async ({ topic, message }) => {
            if (!message.value) return;
            const data = JSON.parse(message.value.toString());
            const type = TOPIC_TO_TYPE[topic];
            // crash.rounds — общие для всех; у остальных событий есть playerId.
            // Ставки (bet) дополнительно идут в общую ленту — это решает EventsController.
            this.events$.next({ type, data, playerId: type === 'crash' ? undefined : data.playerId });
          },
        });
        this.logger.log('SSE: читаю Kafka');
        await crashed; // kafkajs сдался насовсем — пересоздаём консьюмер
        this.logger.warn('SSE: Kafka-консьюмер остановлен, переподключаюсь');
        await consumer.disconnect().catch(() => undefined);
      } catch (e) {
        this.logger.warn(`SSE: Kafka недоступна (${(e as Error).message}), повтор через 5с`);
      }
      await sleep(5_000);
    }
  }

  private runRabbit() {
    this.rabbit = connect([config.rabbitUrl]);
    this.channel = this.rabbit.createChannel({
      // setup выполняется заново при каждом переподключении
      setup: async (ch: import('amqplib').ConfirmChannel) => {
        const { queue } = await ch.assertQueue('', { exclusive: true, autoDelete: true });
        await ch.bindQueue(queue, NOTIFICATIONS_EXCHANGE, '#');
        await ch.consume(queue, (msg) => msg && this.onNotification(msg), { noAck: true });
      },
    });
    this.channel.on('connect', () => this.logger.log('SSE: слушаю RabbitMQ (exchange notifications)'));
  }

  private onNotification(msg: ConsumeMessage) {
    const routingKey = msg.fields.routingKey;
    if (routingKey.startsWith('admin.')) return; // служебные — не для игроков
    try {
      const { data } = JSON.parse(msg.content.toString());
      if (data?.playerId) this.events$.next({ type: 'notification', playerId: data.playerId, data: { routingKey, ...data } });
    } catch {
      // не JSON — пропускаем
    }
  }
}
