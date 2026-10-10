import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { TRANSACTION_VERIFICATION_QUEUE } from '../solana/queues';
import { SolanaModule } from '../solana/solana.module';
import {
  GroupSettlementsController,
  SettlementsController,
} from './settlements.controller';
import { SettlementsService } from './settlements.service';

@Module({
  imports: [
    BullModule.registerQueue({ name: TRANSACTION_VERIFICATION_QUEUE }),
    forwardRef(() => SolanaModule),
  ],
  controllers: [GroupSettlementsController, SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
