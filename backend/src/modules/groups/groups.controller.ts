import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GroupsService } from './groups.service';
import {
  CreateGroupDto,
  JoinGroupDto,
  UpdateGroupDto,
} from './dto/groups.dto';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groups: GroupsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateGroupDto) {
    return this.groups.create(userId, dto);
  }

  @Get()
  findAll(@CurrentUser('id') userId: string) {
    return this.groups.findAllForUser(userId);
  }

  @Get(':id')
  findOne(@CurrentUser('id') userId: string, @Param('id') groupId: string) {
    return this.groups.findOne(userId, groupId);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('id') groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.groups.update(userId, groupId, dto);
  }

  @Delete(':id')
  remove(@CurrentUser('id') userId: string, @Param('id') groupId: string) {
    return this.groups.remove(userId, groupId);
  }

  @Post(':id/invite')
  invite(@CurrentUser('id') userId: string, @Param('id') groupId: string) {
    return this.groups.regenerateInvite(userId, groupId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/join')
  join(@CurrentUser('id') userId: string, @Body() dto: JoinGroupDto) {
    return this.groups.join(userId, dto.inviteCode);
  }

  @Post(':id/leave')
  leave(@CurrentUser('id') userId: string, @Param('id') groupId: string) {
    return this.groups.leave(userId, groupId);
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser('id') userId: string,
    @Param('id') groupId: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.groups.removeMember(userId, groupId, targetUserId);
  }
}
