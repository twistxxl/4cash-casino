import { OnModuleDestroy, OnModuleInit, Provider } from '@nestjs/common';
import { Kafka, logLevel, Partitioners, Producer } from 'kafkajs';
import { config } from './config';

/**
 * Продюсер на "голом" kafkajs. Nest-овский ClientKafka.emit тоже умеет слать,
 * но здесь удобнее явно дождаться подтверждения брокера (await send) и слать батчи.
 */
export class KafkaPublisher implements OnModuleInit, OnModuleDestroy {
  private readonly producer: Producer;

  constructor(clientId: string) {
    this.producer = new Kafka({ clientId, brokers: config.kafkaBrokers, logLevel: logLevel.WARN }).producer({
      // DefaultPartitioner: murmur2(key) % partitions — как в Java-клиенте
      createPartitioner: Partitioners.DefaultPartitioner,
    });
  }

  onModuleInit() {
    return this.producer.connect();
  }

  onModuleDestroy() {
    return this.producer.disconnect();
  }

  async publish(topic: string, key: string, value: unknown) {
    await this.producer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
  }

  async publishMany(topic: string, messages: Array<{ key: string; value: unknown }>) {
    if (!messages.length) return;
    await this.producer.send({
      topic,
      messages: messages.map((m) => ({ key: m.key, value: JSON.stringify(m.value) })),
    });
  }
}

export const kafkaPublisherProvider = (clientId: string): Provider => ({
  provide: KafkaPublisher,
  useFactory: () => new KafkaPublisher(clientId),
});
