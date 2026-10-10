import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('search')
  search(@Query('q') q?: string) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('Query parameter "q" is required');
    }
    return this.users.search(q.trim());
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.users.findById(id);
  }
}
