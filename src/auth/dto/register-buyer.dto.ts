import { IsOptional, IsString } from 'class-validator';

export class RegisterBuyerDto {
  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  name?: string;
}
