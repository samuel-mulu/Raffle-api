import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CampaignStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CREATOR)
@Controller('creator/campaigns')
export class CreatorCampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  findCreatorList(@CurrentUser() user: any) {
    return this.campaigns.findByCreator(user.sub);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: CreateCampaignDto) {
    dto.creatorId = user.sub;
    return this.campaigns.create(dto);
  }

  @Get(':id/stats')
  async getStats(@CurrentUser() user: any, @Param('id') id: string) {
    const campaign = await this.campaigns.findOne(id);
    if (campaign.creatorId !== user.sub) {
      throw new BadRequestException('You do not own this campaign');
    }
    return this.campaigns.getCampaignTicketSummary(id);
  }

  @Patch(':id/links')
  async updateLinks(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { youtube?: string; facebook?: string },
  ) {
    const campaign = await this.campaigns.findOne(id);
    if (campaign.creatorId !== user.sub) {
      throw new BadRequestException('You do not own this campaign');
    }
    return this.campaigns.updateLinks(id, body);
  }
}
