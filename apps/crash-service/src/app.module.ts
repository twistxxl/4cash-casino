import { Module } from '@nestjs/common';
import { Database, kafkaPublisherProvider } from '@app/common';
import { CrashController } from './crash.controller';
import { CrashEngine } from './crash.engine';

@Module({
  controllers: [CrashController],
  providers: [Database, CrashEngine, kafkaPublisherProvider('crash-service')],
})
export class AppModule {}
