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
import { PrismaService } from '../../prisma/prisma.service';
import { SettlementsService } from '../settlements/settlements.service';
import { Public } from '../../common/decorators/public.decorator';

/**
 * Receives Helius enhanced-transaction webhooks for settlement signatures.
 *
 * TODO: set HELIUS_WEBHOOK_SECRET and register this endpoint as the Helius
 * webhook URL (spec 5.2 flow step 5). Without the secret configured, the
 * endpoint only accepts requests in non-production environments.
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
    const secret = this.config.get<string>('helius.webhookSecret');
    if (secret) {
      if (authorization !== secret) {
        throw new UnauthorizedException('Invalid webhook secret');
      }
    } else if (this.config.get<string>('nodeEnv') === 'production') {
      throw new UnauthorizedException(
        'HELIUS_WEBHOOK_SECRET must be configured in production',
      );
    }

    const transactions = Array.isArray(payload) ? payload : [payload];
    let processed = 0;
    for (const tx of transactions) {
      const signature = (tx as { signature?: string })?.signature;
      if (!signature) {
        continue;
      }
      const settlement = await this.prisma.settlement.findFirst({
        where: {
          solanaTransactionId: signature,
          status: { in: ['pending', 'processing'] },
        },
      });
      if (settlement) {
        await this.settlements.markCompletedFromChain(settlement.id, signature);
        processed += 1;
      }
    }
    this.logger.log(
      `Helius webhook: ${transactions.length} tx received, ${processed} settlements completed`,
    );
    return { received: transactions.length, processed };
  }
}
