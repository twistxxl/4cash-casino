import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // Рулетка — stateless (состояние в БД), её можно запускать в нескольких экземплярах:
  // партиции bets.accepted поделятся между ними.
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, kafkaServer('roulette-service', 'roulette-service'));
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`roulette-service (pid ${process.pid}) крутит колесо`, 'Bootstrap');
}
bootstrap();
