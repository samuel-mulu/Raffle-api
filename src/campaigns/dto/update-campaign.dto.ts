import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateCampaignDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  ticketPrice?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  totalTickets?: number;

  @IsOptional()
  @IsDateString()
  drawAt?: string;
}
