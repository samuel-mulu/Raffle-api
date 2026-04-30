import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CampaignStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  findAdminList() {
    return this.campaigns.findAdminList();
  }

  @Post()
  create(@Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: CampaignStatus },
  ) {
    return this.campaigns.updateStatus(id, body.status);
  }
}
