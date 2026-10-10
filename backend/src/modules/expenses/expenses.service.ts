import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupRole, Prisma } from '@prisma/client';
import { EventsService } from '../../common/events/events.service';
import { toDecimal, toMicroUnits } from '../../common/money';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateExpenseDto,
  ExpenseSplitDto,
  UpdateExpenseDto,
} from './dto/expenses.dto';

const expenseInclude = {
  splits: {
    include: {
      user: { select: { id: true, displayName: true, avatar: true } },
    },
  },
  paidBy: { select: { id: true, displayName: true, avatar: true } },
} as const;

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(groupId: string, payerId: string, dto: CreateExpenseDto) {
    await this.requireMember(groupId, payerId);
    const splitUserIds = await this.validateSplits(groupId, dto);

    const expense = await this.prisma.$transaction(async (tx) => {
      const created = await tx.expense.create({
        data: {
          groupId,
          paidById: payerId,
          amount: new Prisma.Decimal(dto.amount),
          description: dto.description,
          category: dto.category,
          date: dto.date ? new Date(dto.date) : undefined,
          receipt: dto.receipt,
          splits: {
            create: dto.splits.map((s) => ({
              userId: s.userId,
              amount: new Prisma.Decimal(s.amount),
              percentage:
                s.percentage !== undefined
                  ? new Prisma.Decimal(s.percentage)
                  : undefined,
            })),
          },
        },
        include: expenseInclude,
      });
      await tx.group.update({
        where: { id: groupId },
        data: { totalSpent: { increment: new Prisma.Decimal(dto.amount) } },
      });
      return created;
    });

    this.events.expenseNew(groupId, expense);
    await this.notifyGroup(groupId, payerId, expense);
    return expense;
  }

  async findAll(groupId: string, userId: string) {
    await this.requireMember(groupId, userId);
    return this.prisma.expense.findMany({
      where: { groupId },
      include: expenseInclude,
      orderBy: { date: 'desc' },
    });
  }

  async findOne(groupId: string, userId: string, id: string) {
    await this.requireMember(groupId, userId);
    const expense = await this.prisma.expense.findFirst({
      where: { id, groupId },
      include: expenseInclude,
    });
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense;
  }

  async update(
    groupId: string,
    userId: string,
    id: string,
    dto: UpdateExpenseDto,
  ) {
    const expense = await this.findOne(groupId, userId, id);
    await this.requirePayerOrAdmin(groupId, userId, expense.paidById);

    const newAmount = dto.amount ?? Number(expense.amount);
    if (dto.splits) {
      this.assertSplitsSum(dto.splits, newAmount);
      await this.assertMembers(
        groupId,
        dto.splits.map((s) => s.userId),
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.splits) {
        await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
        await tx.expenseSplit.createMany({
          data: dto.splits.map((s) => ({
            expenseId: id,
            userId: s.userId,
            amount: new Prisma.Decimal(s.amount),
            percentage:
              s.percentage !== undefined
                ? new Prisma.Decimal(s.percentage)
                : undefined,
          })),
        });
      }
      const saved = await tx.expense.update({
        where: { id },
        data: {
          amount:
            dto.amount !== undefined
              ? new Prisma.Decimal(dto.amount)
              : undefined,
          description: dto.description,
          category: dto.category,
          date: dto.date ? new Date(dto.date) : undefined,
          receipt: dto.receipt,
        },
        include: expenseInclude,
      });
      const delta = toMicroUnits(saved.amount) - toMicroUnits(expense.amount);
      if (delta !== 0n) {
        await tx.group.update({
          where: { id: groupId },
          data: { totalSpent: { increment: toDecimal(delta) } },
        });
      }
      return saved;
    });

    this.events.expenseUpdated(groupId, updated);
    return updated;
  }

  async remove(groupId: string, userId: string, id: string) {
    const expense = await this.findOne(groupId, userId, id);
    await this.requirePayerOrAdmin(groupId, userId, expense.paidById);

    await this.prisma.$transaction(async (tx) => {
      await tx.expense.delete({ where: { id } });
      await tx.group.update({
        where: { id: groupId },
        data: {
          totalSpent: { decrement: new Prisma.Decimal(expense.amount) },
        },
      });
    });

    this.events.expenseDeleted(groupId, { id });
    return { deleted: true };
  }

  private async validateSplits(
    groupId: string,
    dto: CreateExpenseDto,
  ): Promise<string[]> {
    this.assertSplitsSum(dto.splits, dto.amount);
    const userIds = dto.splits.map((s) => s.userId);
    if (new Set(userIds).size !== userIds.length) {
      throw new BadRequestException('Duplicate user in splits');
    }
    await this.assertMembers(groupId, userIds);
    return userIds;
  }

  private assertSplitsSum(splits: ExpenseSplitDto[], amount: number) {
    const totalMicro = toMicroUnits(amount);
    const splitsMicro = splits.reduce(
      (sum, s) => sum + toMicroUnits(s.amount),
      0n,
    );
    if (splitsMicro !== totalMicro) {
      throw new BadRequestException(
        'Splits sum must equal the expense amount',
      );
    }
  }

  private async assertMembers(groupId: string, userIds: string[]) {
    const count = await this.prisma.groupMember.count({
      where: { groupId, userId: { in: userIds } },
    });
    if (count !== userIds.length) {
      throw new BadRequestException('All split users must be group members');
    }
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

  private async requirePayerOrAdmin(
    groupId: string,
    userId: string,
    paidById: string,
  ) {
    if (userId === paidById) {
      return;
    }
    const member = await this.requireMember(groupId, userId);
    if (member.role !== GroupRole.admin) {
      throw new ForbiddenException(
        'Only the payer or a group admin can modify this expense',
      );
    }
  }

  private async notifyGroup(
    groupId: string,
    payerId: string,
    expense: { id: string; description: string; amount: Prisma.Decimal },
  ) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { not: payerId } },
      select: { userId: true },
    });
    await this.notifications.createForUsers(
      members.map((m) => m.userId),
      'expense_added',
      'New expense',
      `${expense.description} — ${expense.amount} USDC`,
      { groupId, expenseId: expense.id },
    );
  }
}
