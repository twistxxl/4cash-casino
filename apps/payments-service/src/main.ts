import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { QUEUES, rmqServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // prefetch = сколько выплат один воркер обрабатывает одновременно (Unacked в UI)
  const prefetchCount = Number(process.env.PREFETCH ?? 2);
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, rmqServer(QUEUES.PAYOUTS, { noAck: false, prefetchCount }));
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`payments-service (pid ${process.pid}) обрабатывает очередь "${QUEUES.PAYOUTS}", prefetch ${prefetchCount}`, 'Bootstrap');
}
bootstrap();
