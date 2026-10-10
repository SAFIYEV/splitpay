import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { SettlementsModule } from '../settlements/settlements.module';
import { HeliusWebhookController } from './helius-webhook.controller';
import { SolanaService } from './solana.service';
import { TRANSACTION_VERIFICATION_QUEUE } from './queues';
import { TransactionVerificationProcessor } from './transaction-verification.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRANSACTION_VERIFICATION_QUEUE }),
    forwardRef(() => SettlementsModule),
  ],
  controllers: [HeliusWebhookController],
  providers: [SolanaService, TransactionVerificationProcessor],
  exports: [SolanaService],
})
export class SolanaModule {}
