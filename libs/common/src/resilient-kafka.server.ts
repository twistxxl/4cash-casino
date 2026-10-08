import { Logger } from '@nestjs/common';
import { KafkaOptions, ServerKafka } from '@nestjs/microservices';
import { sleep } from './config';

const RESTART_DELAY_MS = 5_000;

/**
 * ServerKafka, который поднимает консьюмер заново, если kafkajs остановил его насовсем.
 *
 * kafkajs сам перезапускает консьюмер только после "повторяемых" ошибок.
 * Но после перезапуска брокера бывает KafkaJSGroupCoordinatorNotFound — она НЕ повторяемая,
 * и консьюмер молча останавливается: процесс жив, логов нет, а сообщения больше не читаются
 * (в Kafka UI у группы "no active members", lag растёт).
 * Воспроизвести без этой обёртки: `docker stop casino-kafka`, подождать, `docker start casino-kafka`.
 */
export class ResilientServerKafka extends ServerKafka {
  private readonly log = new Logger('ResilientKafka');
  private restarting = false;
  /** Консьюмер упал снова, пока мы его поднимали — нужен ещё один круг */
  private crashedWhileRestarting = false;

  constructor(options: Required<KafkaOptions>['options']) {
    super(options);
  }

  protected registerConsumerEventListeners() {
    super.registerConsumerEventListeners();
    this.consumer?.on(this.consumer.events.CRASH, ({ payload }) => {
      if (!payload.restart) void this.restart(payload.error);
    });
  }

  private async restart(reason: Error) {
    if (this.restarting) {
      this.crashedWhileRestarting = true;
      return;
    }
    this.restarting = true;
    try {
      do {
        this.crashedWhileRestarting = false;
        this.log.warn(`kafkajs остановил консьюмер насовсем (${reason.name}). Перезапускаю через ${RESTART_DELAY_MS / 1000}с`);
        await this.restartUntilConnected();
      } while (this.crashedWhileRestarting);
    } finally {
      this.restarting = false;
    }
  }

  private async restartUntilConnected() {
    for (let attempt = 1; ; attempt++) {
      await sleep(RESTART_DELAY_MS);
      try {
        await this.close().catch(() => undefined);
        // listen() заново создаёт клиент, консьюмер и подписки на все обработчики
        await new Promise<void>((resolve, reject) => this.listen((err?: unknown) => (err ? reject(err) : resolve())));
        this.log.log(`консьюмер снова работает (попытка ${attempt})`);
        return;
      } catch (e) {
        this.log.warn(`перезапуск не удался (${(e as Error).message}), пробую ещё`);
      }
    }
  }
}
