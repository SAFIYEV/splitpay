import {
  Body,
  Controller,
  forwardRef,
  Headers,
  Inject,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SettlementsService } from '../settlements/settlements.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Receives Helius enhanced-transaction webhooks for settlement signatures.
 * The webhook never completes settlements directly — it only enqueues a
 * verification job, which requires the parsed on-chain payment to match the
 * settlement (mint, amount, payer ATA, recipient ATA).
 *
 * Requires HELIUS_WEBHOOK_SECRET in every environment: without it the
 * endpoint fails closed (401).
 */
@Public()
@Controller('webhooks')
export class HeliusWebhookController {
  private readonly logger = new Logger(HeliusWebhookController.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => SettlementsService))
    private readonly settlements: SettlementsService,
  ) {}

  @Post('helius')
  async handleHelius(
    @Headers('authorization') authorization: string | undefined,
    @Body() payload: unknown,
  ) {
    this.assertAuthorized(authorization);

    const transactions = Array.isArray(payload) ? payload : [payload];
    let queued = 0;
    for (const tx of transactions) {
      const signature = (tx as { signature?: string })?.signature;
      if (!signature) {
        continue;
      }
      const settlement = await this.prisma.settlement.findFirst({
        where: { solanaTransactionId: signature, status: 'processing' },
        select: { id: true },
      });
      if (settlement) {
        await this.settlements.enqueueVerification(settlement.id, signature);
        queued += 1;
      }
    }
    this.logger.log(
      `Helius webhook: ${transactions.length} tx received, ${queued} verification jobs queued`,
    );
    return { received: transactions.length, queued };
  }

  private assertAuthorized(authorization: string | undefined) {
    const secret = this.config.get<string>('helius.webhookSecret');
    if (!secret) {
      throw new UnauthorizedException('Webhook secret is not configured');
    }
    const received = Buffer.from(authorization ?? '');
    const expected = Buffer.from(secret);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }
}
