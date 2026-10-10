import { Processor, WorkerHost } from '@nestjs/bullmq';
import { forwardRef, Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { SettlementsService } from '../settlements/settlements.service';
import {
  TRANSACTION_VERIFICATION_QUEUE,
  VerifyTransactionJob,
} from './queues';
import { SolanaService } from './solana.service';

/**
 * Re-checks a submitted settlement transaction on-chain until it confirms
 * (BullMQ retries with backoff are configured on the queue).
 *
 * TODO: once Helius webhooks are live this becomes a safety net; the webhook
 * is the primary confirmation channel (spec 5.2).
 */
@Processor(TRANSACTION_VERIFICATION_QUEUE)
export class TransactionVerificationProcessor extends WorkerHost {
  private readonly logger = new Logger(TransactionVerificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly solana: SolanaService,
    @Inject(forwardRef(() => SettlementsService))
    private readonly settlements: SettlementsService,
  ) {
    super();
  }

  async process(job: Job<VerifyTransactionJob>) {
    const { settlementId, signature } = job.data;
    const settlement = await this.prisma.settlement.findUnique({
      where: { id: settlementId },
    });
    if (!settlement || settlement.status !== 'processing') {
      return { skipped: true };
    }

    const status = await this.solana.getSignatureStatus(signature);
    if (
      status.found &&
      !status.error &&
      (status.confirmationStatus === 'confirmed' ||
        status.confirmationStatus === 'finalized')
    ) {
      await this.settlements.markCompletedFromChain(settlementId, signature);
      return { confirmed: true };
    }

    this.logger.log(
      `Settlement ${settlementId} not confirmed yet (attempt ${job.attemptsMade + 1})`,
    );
    throw new Error('Transaction not confirmed yet');
  }
}
