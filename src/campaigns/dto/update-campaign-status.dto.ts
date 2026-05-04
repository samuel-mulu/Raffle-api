import { CampaignStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateCampaignStatusDto {
  @IsEnum(CampaignStatus)
  status: CampaignStatus;
}
