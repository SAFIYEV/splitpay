import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SettlementsService } from './settlements.service';
import {
  ConfirmSettlementDto,
  CreateSettlementDto,
  UpdateSettlementStatusDto,
} from './dto/settlements.dto';

@Controller('groups/:groupId/settlements')
export class GroupSettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Get('balance')
  getBalance(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.settlements.getBalance(groupId, userId);
  }

  @Get()
  getHistory(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.settlements.getHistory(groupId, userId);
  }

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateSettlementDto,
  ) {
    return this.settlements.create(groupId, userId, dto);
  }
}

@Controller('settlements')
export class SettlementsController {
  constructor(private readonly settlements: SettlementsService) {}

  @Patch(':id')
  updateStatus(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSettlementStatusDto,
  ) {
    return this.settlements.updateStatus(id, userId, dto);
  }

  @Post(':id/prepare-tx')
  prepareTx(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.settlements.prepareTx(id, userId);
  }

  @Post(':id/confirm')
  confirm(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() dto: ConfirmSettlementDto,
  ) {
    return this.settlements.confirm(id, userId, dto);
  }

  @Get(':id/verify')
  verify(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.settlements.verify(id, userId);
  }
}
