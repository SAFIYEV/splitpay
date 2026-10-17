import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { GroupRole, Prisma, Settlement, SettlementStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import {
  TRANSACTION_VERIFICATION_QUEUE,
  VerifyTransactionJob,
} from '../solana/queues';
import { EventsService } from '../../common/events/events.service';
import { fromMicroUnits, toMicroUnits } from '../../common/money';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SolanaService } from '../solana/solana.service';
import {
  ConfirmSettlementDto,
  CreateSettlementDto,
  UpdateSettlementStatusDto,
} from './dto/settlements.dto';
import {
  calculateSettlements,
  computeBalances,
} from './settlement-engine';

const SETTLEMENT_TTL_DAYS = 7;

// PATCH /settlements/:id never reaches `completed`: completion requires an
// on-chain-verified USDC payment (see verifyProcessingSettlement). Manual
// transitions are limited to dispute / cancel / retry — they never touch
// group balances, which only count completed settlements.
const ALLOWED_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  pending: ['disputed', 'failed'],
  processing: ['disputed', 'failed'],
  disputed: ['failed'],
  completed: [],
  failed: ['pending'],
};

@Injectable()
export class SettlementsService {
  private readonly logger = new Logger(SettlementsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => SolanaService))
    private readonly solana: SolanaService,
    @InjectQueue(TRANSACTION_VERIFICATION_QUEUE)
    private readonly verificationQueue: Queue<VerifyTransactionJob>,
  ) {}

  /**
   * Spec 7.1: who owes whom in a group. Balances come from all expenses
   * minus completed settlements; transfers are the minimal greedy set.
   */
  async getBalance(groupId: string, userId: string) {
    await this.requireMember(groupId, userId);
    const [expenses, completed] = await Promise.all([
      this.prisma.expense.findMany({
        where: { groupId },
        include: { splits: true },
      }),
      this.prisma.settlement.findMany({
        where: { groupId, status: 'completed' },
      }),
    ]);

    const balances = computeBalances(
      expenses.map((e) => ({
        paidById: e.paidById,
        amount: toMicroUnits(e.amount),
        splits: e.splits.map((s) => ({
          userId: s.userId,
          amount: toMicroUnits(s.amount),
        })),
      })),
      completed.map((s) => ({
        fromUserId: s.fromUserId,
        toUserId: s.toUserId,
        amount: toMicroUnits(s.amount),
      })),
    );

    const transfers = calculateSettlements(balances);
    return {
      balances: [...balances.entries()].map(([uid, amount]) => ({
        userId: uid,
        amount: Number(fromMicroUnits(amount)),
      })),
      debts: transfers.map((t) => ({
        fromUserId: t.fromUserId,
        toUserId: t.toUserId,
        amount: Number(fromMicroUnits(t.amount)),
      })),
    };
  }

  async getHistory(groupId: string, userId: string) {
    await this.requireMember(groupId, userId);
    return this.prisma.settlement.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      include: {
        fromUser: { select: { id: true, displayName: true, avatar: true } },
        toUser: { select: { id: true, displayName: true, avatar: true } },
      },
    });
  }

  async create(groupId: string, userId: string, dto: CreateSettlementDto) {
    // Default: the current user pays. An explicit fromUserId is allowed when
    // the current user is the recipient (recording a received repayment).
    const fromUserId = dto.fromUserId ?? userId;
    if (fromUserId !== userId && dto.toUserId !== userId) {
      throw new ForbiddenException(
        'You can only create settlements where you are one of the parties',
      );
    }
    await this.requireMember(groupId, fromUserId);
    if (dto.toUserId === fromUserId) {
      throw new BadRequestException('Cannot settle with yourself');
    }
    await this.requireMember(groupId, dto.toUserId);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SETTLEMENT_TTL_DAYS);

    const settlement = await this.prisma.settlement.create({
      data: {
        groupId,
        fromUserId,
        toUserId: dto.toUserId,
        amount: new Prisma.Decimal(dto.amount),
        notes: dto.notes,
        expiresAt,
        createdById: userId,
      },
    });

    this.events.settlementNew(groupId, settlement);
    // The counterparty is the one who must act: confirm receipt when the
    // payer recorded an off-chain payment, or pay when the recipient
    // requested it.
    const payerCreated = userId === fromUserId;
    await this.notifications.createForUsers(
      [payerCreated ? dto.toUserId : fromUserId],
      'settlement_reminder',
      payerCreated ? 'Payment recorded' : 'Payment requested',
      payerCreated
        ? `${dto.amount} USDC marked as paid to you — confirm when received`
        : `You owe ${dto.amount} USDC`,
      { groupId, settlementId: settlement.id },
    );
    return settlement;
  }

  async updateStatus(
    id: string,
    userId: string,
    dto: UpdateSettlementStatusDto,
  ) {
    const settlement = await this.findForUpdate(id, userId);
    if (dto.status === 'completed') {
      // Off-chain completion is only possible as counterparty confirmation:
      // the party that did NOT create the record confirms it. Unilateral
      // completion would let anyone fabricate a repayment and rewrite group
      // balances (only completed settlements count toward balances).
      const isCounterparty =
        settlement.createdById.length > 0 &&
        userId !== settlement.createdById &&
        (userId === settlement.fromUserId || userId === settlement.toUserId);
      if (settlement.status !== 'pending' || !isCounterparty) {
        throw new ForbiddenException(
          'Off-chain completion requires confirmation by the counterparty of a pending settlement',
        );
      }
    } else {
      const allowed = ALLOWED_TRANSITIONS[settlement.status];
      if (!allowed.includes(dto.status)) {
        throw new BadRequestException(
          `Cannot transition settlement from ${settlement.status} to ${dto.status}`,
        );
      }
    }
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: dto.status,
        completedAt:
          dto.status === 'completed' ? new Date() : settlement.completedAt,
      },
    });
    await this.afterStatusChange(updated);
    return updated;
  }

  /**
   * Builds the unsigned USDC transfer for the settlement. Only the payer
   * (fromUser) may prepare it, and both sides need a wallet address.
   */
  async prepareTx(id: string, userId: string) {
    const settlement = await this.findOrThrow(id);
    if (settlement.fromUserId !== userId) {
      throw new ForbiddenException('Only the payer can prepare the transaction');
    }
    if (!['pending', 'failed'].includes(settlement.status)) {
      throw new BadRequestException(
        `Settlement is ${settlement.status}, expected pending`,
      );
    }
    this.ensureNotExpired(settlement);
    const [fromUser, toUser] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: settlement.fromUserId } }),
      this.prisma.user.findUnique({ where: { id: settlement.toUserId } }),
    ]);
    if (!fromUser?.walletAddress || !toUser?.walletAddress) {
      throw new BadRequestException(
        'Both users must have a connected wallet address',
      );
    }

    const prepared = await this.solana.buildUsdcTransfer(
      fromUser.walletAddress,
      toUser.walletAddress,
      toMicroUnits(settlement.amount),
    );
    return {
      settlementId: id,
      ...prepared,
      amount: settlement.amount,
      currency: 'USDC',
    };
  }

  /**
   * Records the signed transaction signature and marks the settlement
   * PROCESSING. Completion happens only after the parsed on-chain payment
   * verifies (verification queue + Helius webhook + immediate check below).
   */
  async confirm(id: string, userId: string, dto: ConfirmSettlementDto) {
    const settlement = await this.findOrThrow(id);
    if (settlement.fromUserId !== userId) {
      throw new ForbiddenException('Only the payer can confirm the transaction');
    }
    if (settlement.status !== 'pending') {
      throw new BadRequestException(
        `Settlement is ${settlement.status}, expected pending`,
      );
    }
    this.ensureNotExpired(settlement);

    // Replay protection: one transaction signature pays exactly one
    // settlement (the unique index on solanaTransactionId enforces it too).
    const signatureOwner = await this.prisma.settlement.findFirst({
      where: { solanaTransactionId: dto.signature, id: { not: id } },
      select: { id: true },
    });
    if (signatureOwner) {
      throw new BadRequestException(
        'Transaction signature is already linked to another settlement',
      );
    }

    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'processing', solanaTransactionId: dto.signature },
    });

    await this.enqueueVerification(id, dto.signature);

    // Best-effort immediate verification; the queue keeps re-checking
    // while the transaction is not confirmed yet.
    const outcome = await this.verifyProcessingSettlement(id, dto.signature);
    if (outcome !== 'pending') {
      return this.findOrThrow(id);
    }
    return updated;
  }

  /** Shared verification-job enqueue (confirm endpoint + Helius webhook). */
  async enqueueVerification(id: string, signature: string) {
    await this.verificationQueue
      .add(
        'verify',
        { settlementId: id, signature },
        {
          attempts: 20,
          backoff: { type: 'exponential', delay: 10_000 },
        },
      )
      .catch((err: Error) =>
        this.logger.warn(`Failed to enqueue verification job: ${err.message}`),
      );
  }

  /**
   * Verifies the linked on-chain payment of a processing settlement.
   * Marks it completed only when the parsed transaction proves the exact
   * USDC transferChecked (mint, amount, payer ATA, recipient ATA); marks it
   * failed when the confirmed transaction can never satisfy the settlement.
   */
  async verifyProcessingSettlement(
    id: string,
    signature: string,
  ): Promise<'completed' | 'failed' | 'pending'> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
      include: { fromUser: true, toUser: true },
    });
    if (!settlement || settlement.status !== 'processing') {
      return 'pending';
    }
    if (!settlement.fromUser.walletAddress || !settlement.toUser.walletAddress) {
      this.logger.warn(`Settlement ${id}: missing wallet address`);
      return 'pending';
    }
    const result = await this.solana.verifySettlementPayment(signature, {
      fromWallet: settlement.fromUser.walletAddress,
      toWallet: settlement.toUser.walletAddress,
      amountMicro: toMicroUnits(settlement.amount),
    });
    if (result.status === 'verified') {
      await this.markCompletedFromChain(id, signature);
      return 'completed';
    }
    if (result.status === 'failed') {
      await this.markFailedFromChain(id, result.reason);
      return 'failed';
    }
    return 'pending';
  }

  /** On-chain verification status for a settlement's transaction. */
  async verify(id: string, userId: string) {
    const settlement = await this.findOrThrow(id);
    await this.requireMember(settlement.groupId, userId);
    if (!settlement.solanaTransactionId) {
      return { settlementId: id, status: settlement.status, onChain: null };
    }
    const outcome = await this.verifyProcessingSettlement(
      id,
      settlement.solanaTransactionId,
    );
    const onChain = await this.solana.getSignatureStatus(
      settlement.solanaTransactionId,
    );
    const current = await this.findOrThrow(id);
    return {
      settlementId: id,
      status: outcome === 'pending' ? current.status : outcome,
      onChain,
    };
  }

  /**
   * Completes a settlement after its on-chain payment has been verified.
   * Only the verification paths (queue, webhook-triggered job, confirm/verify
   * endpoints) may call this — never the generic status-update endpoint.
   */
  async markCompletedFromChain(id: string, signature: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement || settlement.status === 'completed') {
      return settlement;
    }
    if (settlement.status !== 'processing') {
      this.logger.warn(
        `Refusing to complete settlement ${id} from status ${settlement.status}`,
      );
      return settlement;
    }
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: {
        status: 'completed',
        solanaTransactionId: signature,
        completedAt: new Date(),
      },
    });
    this.logger.log(`Settlement ${id} completed on-chain (${signature})`);
    await this.afterStatusChange(updated);
    return updated;
  }

  private async markFailedFromChain(id: string, reason: string) {
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'failed' },
    });
    this.logger.warn(
      `Settlement ${id} failed on-chain verification: ${reason}`,
    );
    await this.notifications.createForUsers(
      [updated.fromUserId],
      'settlement_reminder',
      'Payment not verified',
      `Your payment of ${updated.amount} USDC could not be verified on-chain`,
      { groupId: updated.groupId, settlementId: updated.id },
    );
    return updated;
  }

  private ensureNotExpired(settlement: Settlement) {
    if (settlement.expiresAt && settlement.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException(
        'Settlement expired — create a new one',
      );
    }
  }

  private async findForUpdate(id: string, userId: string) {
    const settlement = await this.findOrThrow(id);
    const isParty =
      settlement.fromUserId === userId || settlement.toUserId === userId;
    if (!isParty) {
      const member = await this.requireMember(settlement.groupId, userId);
      if (member.role !== GroupRole.admin) {
        throw new ForbiddenException(
          'Only settlement parties or a group admin can update it',
        );
      }
    }
    return settlement;
  }

  private async findOrThrow(id: string): Promise<Settlement> {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement) {
      throw new NotFoundException('Settlement not found');
    }
    return settlement;
  }

  private async requireMember(groupId: string, userId: string) {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this group');
    }
    return member;
  }

  private async afterStatusChange(settlement: Settlement) {
    if (settlement.status === 'completed') {
      this.events.settlementPaid(settlement.groupId, settlement);
      await this.notifications.createForUsers(
        [settlement.toUserId],
        'payment_received',
        'Payment received',
        `You received ${settlement.amount} USDC`,
        { groupId: settlement.groupId, settlementId: settlement.id },
      );
    } else if (settlement.status === 'disputed') {
      await this.notifications.createForUsers(
        [settlement.fromUserId, settlement.toUserId],
        'dispute_opened',
        'Dispute opened',
        `A dispute was opened for a ${settlement.amount} USDC settlement`,
        { groupId: settlement.groupId, settlementId: settlement.id },
      );
    }
  }
}
