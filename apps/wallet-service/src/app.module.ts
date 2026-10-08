import { Module } from '@nestjs/common';
import { Database, kafkaPublisherProvider, rabbitPublisherProvider } from '@app/common';
import { WalletService } from './wallet.service';
import { OutboxRelay } from './outbox.relay';
import { PayoutResultsController, WalletEventsController, WalletRpcController } from './wallet.controllers';

@Module({
  controllers: [WalletEventsController, WalletRpcController, PayoutResultsController],
  providers: [Database, WalletService, OutboxRelay, kafkaPublisherProvider('wallet-outbox'), rabbitPublisherProvider],
})
export class AppModule {}
