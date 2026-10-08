import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { kafkaServer, QUEUES, rmqServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Гибрид: Kafka (bets.accepted) + RabbitMQ RPC (crash.rpc: кэшаут и состояние раунда)
  const app = await NestFactory.create(AppModule);
  app.connectMicroservice(kafkaServer('crash-service', 'crash-service'));
  app.connectMicroservice(rmqServer(QUEUES.CRASH_RPC));
  app.enableShutdownHooks();
  await app.init();
  await app.startAllMicroservices();
  Logger.log(`crash-service (pid ${process.pid}) запущен. Запускай только ОДИН экземпляр!`, 'Bootstrap');
}
bootstrap();
