import { ClientProviderOptions, MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import { config } from './config';
import { QUEUE_OPTIONS, QueueName } from './messaging';
import { ResilientServerKafka } from './resilient-kafka.server';

/**
 * Kafka-консьюмер для Nest. Nest добавит к groupId суффикс "-server":
 * в Kafka UI группа будет называться, например, "wallet-service-server".
 *
 * Вместо стандартного `transport: Transport.KAFKA` используется своя стратегия
 * ResilientServerKafka — она переживает перезапуск брокера (см. комментарий в ней).
 */
export function kafkaServer(
  clientId: string,
  groupId: string,
  opts: { fromBeginning?: boolean } = {},
): MicroserviceOptions {
  return {
    strategy: new ResilientServerKafka({
      client: { clientId: `${clientId}-${process.pid}`, brokers: config.kafkaBrokers },
      consumer: { groupId },
      subscribe: { fromBeginning: opts.fromBeginning ?? false },
      producer: { createPartitioner: Partitioners.DefaultPartitioner },
    }),
  };
}

/**
 * RabbitMQ-консьюмер очереди.
 * noAck: true  — брокер считает сообщение доставленным сразу (для RPC — ок).
 * noAck: false — нужно руками ack/nack, иначе сообщение вернётся в очередь при падении.
 */
export function rmqServer(queue: QueueName, opts: { noAck?: boolean; prefetchCount?: number } = {}): MicroserviceOptions {
  return {
    transport: Transport.RMQ,
    options: {
      urls: [config.rabbitUrl],
      queue,
      queueOptions: QUEUE_OPTIONS[queue],
      noAck: opts.noAck ?? true,
      prefetchCount: opts.prefetchCount ?? 1,
    },
  };
}

/** RPC-клиент в очередь RabbitMQ (ответ приходит через direct reply-to) */
export function rmqClient(name: string, queue: QueueName): ClientProviderOptions {
  return {
    name,
    transport: Transport.RMQ,
    options: { urls: [config.rabbitUrl], queue, queueOptions: QUEUE_OPTIONS[queue] },
  };
}
