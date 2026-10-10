import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GroupMember, GroupRole, GroupStatus } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { EventsService } from '../../common/events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateGroupDto, UpdateGroupDto } from './dto/groups.dto';

const groupInclude = {
  members: {
    include: {
      user: {
        select: {
          id: true,
          displayName: true,
          avatar: true,
          walletAddress: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class GroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateGroupDto) {
    return this.prisma.group.create({
      data: {
        name: dto.name,
        description: dto.description,
        photo: dto.photo,
        splitMethod: dto.splitMethod,
        inviteCode: this.generateInviteCode(),
        members: { create: { userId, role: GroupRole.admin } },
      },
      include: groupInclude,
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.groupMember.findMany({
      where: { userId, group: { status: GroupStatus.active } },
      include: { group: { include: groupInclude } },
      orderBy: { joinedAt: 'desc' },
    });
    return memberships.map((m) => m.group);
  }

  async findOne(userId: string, groupId: string) {
    await this.requireMember(groupId, userId);
    return this.prisma.group.findUnique({
      where: { id: groupId },
      include: groupInclude,
    });
  }

  async update(userId: string, groupId: string, dto: UpdateGroupDto) {
    await this.requireAdmin(groupId, userId);
    return this.prisma.group.update({
      where: { id: groupId },
      data: dto,
      include: groupInclude,
    });
  }

  async remove(userId: string, groupId: string) {
    await this.requireAdmin(groupId, userId);
    await this.prisma.group.delete({ where: { id: groupId } });
    return { deleted: true };
  }

  async getInvite(userId: string, groupId: string) {
    await this.requireMember(groupId, userId);
    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { inviteCode: true },
    });
    if (!group) {
      throw new NotFoundException('Group not found');
    }
    return { inviteCode: group.inviteCode };
  }

  async regenerateInvite(userId: string, groupId: string) {
    await this.requireAdmin(groupId, userId);
    const group = await this.prisma.group.update({
      where: { id: groupId },
      data: { inviteCode: this.generateInviteCode() },
      select: { inviteCode: true },
    });
    return group;
  }

  async join(userId: string, inviteCode: string) {
    const group = await this.prisma.group.findUnique({
      where: { inviteCode },
    });
    if (!group || group.status !== GroupStatus.active) {
      throw new NotFoundException('Invalid invite code');
    }
    const existing = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId: group.id, userId } },
    });
    if (existing) {
      throw new ConflictException('Already a member of this group');
    }
    const member = await this.prisma.groupMember.create({
      data: { groupId: group.id, userId, role: GroupRole.member },
      include: { user: true, group: { include: groupInclude } },
    });
    this.events.memberJoined(group.id, {
      userId,
      displayName: member.user.displayName,
    });
    await this.notifyMembers(
      group.id,
      userId,
      'member_joined',
      'New member joined',
      `${member.user.displayName} joined "${group.name}"`,
      { groupId: group.id },
    );
    return member.group;
  }

  async leave(userId: string, groupId: string) {
    const member = await this.requireMember(groupId, userId);
    await this.prisma.groupMember.delete({ where: { id: member.id } });
    this.events.memberLeft(groupId, { userId });
    return { left: true };
  }

  async removeMember(userId: string, groupId: string, targetUserId: string) {
    await this.requireAdmin(groupId, userId);
    if (userId === targetUserId) {
      throw new ConflictException('Use /leave to remove yourself');
    }
    const target = await this.requireMember(groupId, targetUserId);
    await this.prisma.groupMember.delete({ where: { id: target.id } });
    this.events.memberLeft(groupId, { userId: targetUserId });
    return { removed: true };
  }

  async requireMember(groupId: string, userId: string): Promise<GroupMember> {
    const member = await this.prisma.groupMember.findUnique({
      where: { groupId_userId: { groupId, userId } },
    });
    if (!member) {
      throw new ForbiddenException('Not a member of this group');
    }
    return member;
  }

  async requireAdmin(groupId: string, userId: string): Promise<GroupMember> {
    const member = await this.requireMember(groupId, userId);
    if (member.role !== GroupRole.admin) {
      throw new ForbiddenException('Admin role required');
    }
    return member;
  }

  private async notifyMembers(
    groupId: string,
    excludeUserId: string,
    type:
      | 'expense_added'
      | 'settlement_reminder'
      | 'payment_received'
      | 'member_joined'
      | 'group_invite'
      | 'dispute_opened',
    title: string,
    body: string,
    data: Record<string, string>,
  ) {
    const members = await this.prisma.groupMember.findMany({
      where: { groupId, userId: { not: excludeUserId } },
      select: { userId: true },
    });
    await this.notifications.createForUsers(
      members.map((m) => m.userId),
      type,
      title,
      body,
      data,
    );
  }

  private generateInviteCode(): string {
    return randomBytes(4).toString('hex');
  }
}
