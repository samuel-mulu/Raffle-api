import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { AdminCampaignsController } from './admin-campaigns.controller';

@Module({
  providers: [CampaignsService],
  controllers: [CampaignsController, AdminCampaignsController],
})
export class CampaignsModule {}
