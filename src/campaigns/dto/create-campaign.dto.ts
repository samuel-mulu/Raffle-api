import {
  IsInt,
  IsOptional,
  IsString,
  Min,
  IsDateString,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsInt()
  @Min(1)
  ticketPrice: number;

  @IsInt()
  @Min(1)
  totalTickets: number;

  @IsOptional()
  @IsDateString()
  drawAt?: string;
}
