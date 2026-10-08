import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { QUEUES, rmqServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Nest RMQ-сервер слушает одну очередь, поэтому подключаем три "микросервиса" в одно приложение.
  // Очередь notifications.audit никто не читает — она копит копии всех уведомлений для просмотра в UI.
  const app = await NestFactory.create(AppModule);
  for (const queue of [QUEUES.NOTIFY_PUSH, QUEUES.NOTIFY_EMAIL, QUEUES.NOTIFY_ADMIN]) {
    app.connectMicroservice(rmqServer(queue, { noAck: false, prefetchCount: 5 }));
  }
  app.enableShutdownHooks();
  await app.init();
  await app.startAllMicroservices();
  Logger.log(`notifications-service (pid ${process.pid}) слушает push / email / admin`, 'Bootstrap');
}
bootstrap();
