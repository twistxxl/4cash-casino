import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Своя consumer group: читает bets.placed / bets.settled / wallet.transactions
  // независимо от wallet-service и не мешает ему.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, kafkaServer('risk-service', 'risk-service'));
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`risk-service (pid ${process.pid}) следит за игроками`, 'Bootstrap');
}
bootstrap();
