import { Module } from '@nestjs/common';
import { Database, kafkaPublisherProvider } from '@app/common';
import { RouletteController } from './roulette.controller';

@Module({
  controllers: [RouletteController],
  providers: [Database, kafkaPublisherProvider('roulette-service')],
})
export class AppModule {}
