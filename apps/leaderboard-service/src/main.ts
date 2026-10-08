import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions } from '@nestjs/microservices';
import { kafkaServer } from '@app/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // LEADERBOARD_GROUP=leaderboard-v2 → новая группа без офсетов → прочитает всю историю с начала
  const group = process.env.LEADERBOARD_GROUP ?? 'leaderboard-service';
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    kafkaServer('leaderboard-service', group, { fromBeginning: true }),
  );
  app.enableShutdownHooks();
  await app.listen();
  Logger.log(`leaderboard-service (pid ${process.pid}, группа "${group}-server") считает`, 'Bootstrap');
}
bootstrap();
