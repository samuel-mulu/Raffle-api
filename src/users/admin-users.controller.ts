import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { JwtUser } from '../auth/types/jwt-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  createStaff(@CurrentUser() user: JwtUser, @Body() dto: CreateStaffUserDto) {
    return this.users.createStaff(user.sub, dto);
  }

  @Get()
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.users.listUsers(query.role);
  }
}
