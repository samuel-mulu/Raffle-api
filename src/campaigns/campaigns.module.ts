import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { AdminCampaignsController } from './admin-campaigns.controller';
import { CreatorCampaignsController } from './creator-campaigns.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    CampaignsController,
    AdminCampaignsController,
    CreatorCampaignsController,
  ],
  providers: [CampaignsService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
