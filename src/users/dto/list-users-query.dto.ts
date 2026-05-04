import { Role } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';

export class ListUsersQueryDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
