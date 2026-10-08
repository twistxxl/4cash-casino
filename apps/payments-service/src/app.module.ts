import { Module } from '@nestjs/common';
import { rabbitPublisherProvider } from '@app/common';
import { PaymentsController } from './payments.controller';

@Module({
  controllers: [PaymentsController],
  providers: [rabbitPublisherProvider],
})
export class AppModule {}
