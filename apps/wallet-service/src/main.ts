import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { kafkaServer, QUEUES, rmqServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Гибридное приложение: HTTP не слушаем, только брокеры
  const app = await NestFactory.create(AppModule);

  // Kafka: bets.placed, bets.settled, risk.alerts (группа "wallet-service-server")
  app.connectMicroservice(kafkaServer('wallet-service', 'wallet-service'));
  // RabbitMQ RPC от gateway
  app.connectMicroservice(rmqServer(QUEUES.WALLET_RPC));
  // RabbitMQ: результаты выплат, ручной ack
  app.connectMicroservice(rmqServer(QUEUES.PAYOUT_RESULTS, { noAck: false }));

  app.enableShutdownHooks();
  await app.init();
  await app.startAllMicroservices();
  Logger.log(`wallet-service (pid ${process.pid}) запущен`, 'Bootstrap');
}
bootstrap();
