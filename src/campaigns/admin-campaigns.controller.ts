import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt.guard';
import type { JwtUser } from '../auth/types/jwt-user.type';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CampaignExportsService } from './campaign-exports.service';
import { CampaignsService } from './campaigns.service';
import { CampaignBuyersQueryDto } from './dto/campaign-buyers-query.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignStatusDto } from './dto/update-campaign-status.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/campaigns')
export class AdminCampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly exportsService: CampaignExportsService,
  ) {}

  @Get()
  findAdminList() {
    return this.campaigns.findAdminList();
  }

  @Get('review')
  findReviewQueue() {
    return this.campaigns.findReviewQueue();
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(dto, user.sub);
  }

  @Get(':id/buyers')
  getBuyers(@Param('id') id: string, @Query() query: CampaignBuyersQueryDto) {
    return this.campaigns.getAdminCampaignBuyers(id, query);
  }

  @Get(':id/exports.xlsx')
  async exportXlsx(@Param('id') id: string, @Res() res: Response) {
    const file = await this.exportsService.exportAdminCampaignXlsx(id);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get(':id/exports.pdf')
  async exportPdf(@Param('id') id: string, @Res() res: Response) {
    const file = await this.exportsService.exportAdminCampaignPdf(id);

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: UpdateCampaignStatusDto,
  ) {
    return this.campaigns.updateStatus(id, body.status, user.sub);
  }
}
