import { Processor, WorkerHost } from '@nestjs/bullmq';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SettlementsService } from '../settlements/settlements.service';
import {
  TRANSACTION_VERIFICATION_QUEUE,
  VerifyTransactionJob,
} from './queues';

/**
 * Re-checks a submitted settlement transaction on-chain until the payment
 * verifies (full transferChecked content check), definitively fails, or the
 * job exhausts its retries (BullMQ backoff configured at enqueue time).
 */
@Processor(TRANSACTION_VERIFICATION_QUEUE)
export class TransactionVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionVerificationProcessor.name);

  constructor(
    @Inject(forwardRef(() => SettlementsService))
    private readonly settlements: SettlementsService,
  ) {
    super();
  }

  async process(job: Job<VerifyTransactionJob>) {
    const { settlementId, signature } = job.data;
    const outcome = await this.settlements.verifyProcessingSettlement(
      settlementId,
      signature,
    );
    if (outcome === 'pending') {
      this.logger.log(
        `Settlement ${settlementId} not verified yet (attempt ${job.attemptsMade + 1})`,
      );
      throw new Error('Transaction not verified yet');
    }
    return { outcome };
  }
}
