import { Role } from '@prisma/client';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateStaffUserDto {
  @IsString()
  phone: string;

  @IsIn([Role.CREATOR, Role.ADMIN])
  role: Role;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
