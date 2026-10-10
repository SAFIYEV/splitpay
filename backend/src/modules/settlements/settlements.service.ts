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

const ALLOWED_TRANSITIONS: Record<SettlementStatus, SettlementStatus[]> = {
  pending: ['processing', 'completed', 'failed', 'disputed'],
  processing: ['completed', 'failed', 'disputed'],
  disputed: ['completed', 'failed'],
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

  async create(groupId: string, fromUserId: string, dto: CreateSettlementDto) {
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
      },
    });

    this.events.settlementNew(groupId, settlement);
    await this.notifications.createForUsers(
      [fromUserId],
      'settlement_reminder',
      'Payment requested',
      `You owe ${dto.amount} USDC`,
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
    const allowed = ALLOWED_TRANSITIONS[settlement.status];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition settlement from ${settlement.status} to ${dto.status}`,
      );
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
   * PROCESSING. Confirmation arrives via Helius webhook or the
   * transaction-verification queue.
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
    const updated = await this.prisma.settlement.update({
      where: { id },
      data: { status: 'processing', solanaTransactionId: dto.signature },
    });

    await this.verificationQueue
      .add(
        'verify',
        { settlementId: id, signature: dto.signature },
        {
          attempts: 20,
          backoff: { type: 'exponential', delay: 10_000 },
        },
      )
      .catch((err: Error) =>
        this.logger.warn(`Failed to enqueue verification job: ${err.message}`),
      );

    // Best-effort immediate check; the queue keeps re-checking otherwise.
    const status = await this.solana.getSignatureStatus(dto.signature);
    if (
      status.found &&
      !status.error &&
      (status.confirmationStatus === 'confirmed' ||
        status.confirmationStatus === 'finalized')
    ) {
      return this.markCompletedFromChain(id, dto.signature);
    }
    return updated;
  }

  /** On-chain verification status for a settlement's transaction. */
  async verify(id: string, userId: string) {
    const settlement = await this.findOrThrow(id);
    await this.requireMember(settlement.groupId, userId);
    if (!settlement.solanaTransactionId) {
      return { settlementId: id, status: settlement.status, onChain: null };
    }
    const onChain = await this.solana.getSignatureStatus(
      settlement.solanaTransactionId,
    );
    if (
      settlement.status === 'processing' &&
      onChain.found &&
      !onChain.error &&
      (onChain.confirmationStatus === 'confirmed' ||
        onChain.confirmationStatus === 'finalized')
    ) {
      await this.markCompletedFromChain(id, settlement.solanaTransactionId);
      return { settlementId: id, status: 'completed', onChain };
    }
    return { settlementId: id, status: settlement.status, onChain };
  }

  /** Called by the Helius webhook / verification queue once a tx confirms. */
  async markCompletedFromChain(id: string, signature: string) {
    const settlement = await this.prisma.settlement.findUnique({
      where: { id },
    });
    if (!settlement || settlement.status === 'completed') {
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
