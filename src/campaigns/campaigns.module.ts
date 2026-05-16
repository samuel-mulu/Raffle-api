import { Module } from '@nestjs/common';
import { CampaignExportsService } from './campaign-exports.service';
import { CampaignImportPreviewService } from './campaign-import-preview.service';
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
  providers: [CampaignsService, CampaignExportsService, CampaignImportPreviewService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
