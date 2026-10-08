import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { Partitioners } from 'kafkajs';
import {
  config,
  CRASH_RPC_CLIENT,
  KAFKA_RPC_CLIENT,
  kafkaPublisherProvider,
  QUEUES,
  rmqClient,
  WALLET_RPC_CLIENT,
} from '@app/common';
import { PlayersController } from './players.controller';
import { BetsController } from './bets.controller';
import { CrashController, LeaderboardController } from './games.controller';
import { EventsController } from './events.controller';
import { EventStreamService } from './event-stream.service';

@Module({
  imports: [
    ClientsModule.register([
      rmqClient(WALLET_RPC_CLIENT, QUEUES.WALLET_RPC),
      rmqClient(CRASH_RPC_CLIENT, QUEUES.CRASH_RPC),
      {
        name: KAFKA_RPC_CLIENT,
        transport: Transport.KAFKA,
        options: {
          client: { clientId: 'api-gateway', brokers: config.kafkaBrokers },
          // консьюмер нужен только чтобы читать ответы из leaderboard.get.reply (группа "api-gateway-client")
          consumer: { groupId: 'api-gateway' },
          producer: { createPartitioner: Partitioners.DefaultPartitioner },
        },
      },
    ]),
  ],
  controllers: [PlayersController, BetsController, CrashController, LeaderboardController, EventsController],
  providers: [kafkaPublisherProvider('api-gateway'), EventStreamService],
})
export class AppModule {}
