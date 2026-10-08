import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import type { Channel, Message } from 'amqplib';
import {
  MAX_PAYOUT_ATTEMPTS,
  PAYOUT_RETRY_DELAY_MS,
  PayoutResult,
  PayoutTask,
  QUEUES,
  RabbitPublisher,
  RMQ_PATTERNS,
} from '@app/common';
import { transfer } from './fake-provider';

/**
 * Воркер выплат — классическая задача для RabbitMQ:
 *   - каждую выплату должен сделать ровно ОДИН воркер (competing consumers);
 *   - ack только после того, как провайдер ответил;
 *   - временная ошибка → отложенный повтор через очередь payouts.retry (TTL + dead-letter);
 *   - исчерпали попытки → nack → payouts.dlq (разбирать вручную или "Move messages" в UI).
 */
@Controller()
export class PaymentsController {
  private readonly logger = new Logger('Payments');

  constructor(private readonly rabbit: RabbitPublisher) {}

  @EventPattern(RMQ_PATTERNS.PAYOUT_PROCESS)
  async process(@Payload() task: PayoutTask, @Ctx() ctx: RmqContext) {
    const channel = ctx.getChannelRef() as Channel;
    const msg = ctx.getMessage() as Message;
    const tag = `${task.username} ${task.amount} (попытка ${task.attempt}/${MAX_PAYOUT_ATTEMPTS})`;

    try {
      const res = await transfer(task.amount);

      if (res.kind === 'ok') {
        await this.sendResult({ withdrawalId: task.withdrawalId, status: 'completed', providerRef: res.providerRef });
        channel.ack(msg);
        this.logger.log(`✅ ${tag} → выплачено, ${res.providerRef}`);
        return;
      }

      if (res.kind === 'declined') {
        await this.sendResult({ withdrawalId: task.withdrawalId, status: 'failed', reason: res.error });
        channel.ack(msg);
        this.logger.warn(`🚫 ${tag} → отказ провайдера: ${res.error}`);
        return;
      }

      // transient
      if (task.attempt < MAX_PAYOUT_ATTEMPTS) {
        // Публикуем копию с attempt+1 в retry-очередь и подтверждаем оригинал.
        // Через PAYOUT_RETRY_DELAY_MS сообщение само вернётся в payouts.
        await this.rabbit.toQueue(QUEUES.PAYOUTS_RETRY, RMQ_PATTERNS.PAYOUT_PROCESS, { ...task, attempt: task.attempt + 1 });
        channel.ack(msg);
        this.logger.warn(`🔁 ${tag} → ${res.error}, повтор через ${PAYOUT_RETRY_DELAY_MS / 1000}с`);
      } else {
        // requeue=false + x-dead-letter-exchange у очереди → сообщение уходит в payouts.dlq
        channel.nack(msg, false, false);
        this.logger.error(`☠ ${tag} → ${res.error}, попытки кончились → ${QUEUES.PAYOUTS_DLQ}`);
      }
    } catch (e) {
      // Что-то сломалось у нас (например, RabbitMQ недоступен) — вернём в очередь
      this.logger.error(`${tag}: ${(e as Error).message} → requeue`);
      channel.nack(msg, false, true);
    }
  }

  private sendResult(result: PayoutResult) {
    return this.rabbit.toQueue(QUEUES.PAYOUT_RESULTS, RMQ_PATTERNS.PAYOUT_RESULT, result);
  }
}
