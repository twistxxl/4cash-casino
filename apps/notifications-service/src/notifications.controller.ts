import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import { NotificationMessage, RMQ_PATTERNS, sleep } from '@app/common';

// "Отправка" по разным каналам занимает разное время
const DELAY_MS: Record<string, number> = { push: 100, email: 600, admin: 50 };
const ICON: Record<string, string> = { push: '📱', email: '📧', admin: '🛡 ' };

/**
 * Один обработчик на три очереди (push / email / admin).
 * В какую очередь попало сообщение, решил topic exchange "notifications" по routing key.
 * Сам routing key можно достать из AMQP-сообщения: msg.fields.routingKey.
 */
@Controller()
export class NotificationsController {
  private readonly logger = new Logger('Notify');

  @EventPattern(RMQ_PATTERNS.NOTIFY)
  async send(@Payload() n: NotificationMessage, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef() as Channel;
    const msg = ctx.getMessage() as Message;
    const routingKey = msg.fields.routingKey; // например "push.big_win"
    const [kind, event] = routingKey.split('.');

    await sleep(DELAY_MS[kind] ?? 200);
    channel.ack(msg);
    this.logger.log(`${ICON[kind] ?? '✉'} [${kind}:${event}] ${n.text}${msg.fields.redelivered ? ' (redelivered)' : ''}`);
  }
}
