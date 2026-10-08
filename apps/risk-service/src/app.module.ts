import { Module } from '@nestjs/common';
import { Database, kafkaPublisherProvider, rabbitPublisherProvider } from '@app/common';
import { RiskController } from './risk.controller';

@Module({
  controllers: [RiskController],
  providers: [Database, kafkaPublisherProvider('risk-service'), rabbitPublisherProvider],
})
export class AppModule {}
