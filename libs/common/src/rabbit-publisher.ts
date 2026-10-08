import { OnModuleDestroy, Provider } from '@nestjs/common';
import { AmqpConnectionManager, ChannelWrapper, connect } from 'amqp-connection-manager';
import { config } from './config';
import { NOTIFICATIONS_EXCHANGE, RMQ_PATTERNS } from './messaging';
import type { NotificationMessage } from './events';

/**
 * Публикация в RabbitMQ мимо Nest ClientProxy — нужна, чтобы слать в exchange с routing key
 * (Nest-клиент умеет только в одну очередь). Канал в режиме publisher confirms:
 * publish() резолвится, когда брокер подтвердил приём.
 *
 * Exchange'и и очереди создаёт `npm run setup` — здесь только публикация.
 */
export class RabbitPublisher implements OnModuleDestroy {
  private readonly connection: AmqpConnectionManager = connect([config.rabbitUrl]);
  private readonly channel: ChannelWrapper = this.connection.createChannel({ confirm: true });

  /** Сообщение в формате Nest: { pattern, data } */
  async publish(exchange: string, routingKey: string, pattern: string, data: unknown) {
    await this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify({ pattern, data })), {
      persistent: true,
      contentType: 'application/json',
    });
  }

  /** Прямо в очередь через default exchange ("" + routingKey = имя очереди) */
  toQueue(queue: string, pattern: string, data: unknown) {
    return this.publish('', queue, pattern, data);
  }

  /** В topic exchange уведомлений, routingKey вида "push.big_win" */
  notify(routingKey: string, message: NotificationMessage) {
    return this.publish(NOTIFICATIONS_EXCHANGE, routingKey, RMQ_PATTERNS.NOTIFY, message);
  }

  async onModuleDestroy() {
    await this.channel.close();
    await this.connection.close();
  }
}

export const rabbitPublisherProvider: Provider = {
  provide: RabbitPublisher,
  useFactory: () => new RabbitPublisher(),
};
