import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto, UpdateExpenseDto } from './dto/expenses.dto';

@Controller('groups/:groupId/expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Post()
  create(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenses.create(groupId, userId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.expenses.findAll(groupId, userId);
  }

  @Get(':id')
  findOne(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ) {
    return this.expenses.findOne(groupId, userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenses.update(groupId, userId, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser('id') userId: string,
    @Param('groupId') groupId: string,
    @Param('id') id: string,
  ) {
    return this.expenses.remove(groupId, userId, id);
  }
}
