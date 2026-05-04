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
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CREATOR)
@Controller('creator/campaigns')
export class CreatorCampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly exportsService: CampaignExportsService,
  ) {}

  @Get()
  findCreatorList(@CurrentUser() user: JwtUser) {
    return this.campaigns.findByCreator(user.sub);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateCampaignDto) {
    dto.creatorId = user.sub;
    return this.campaigns.create(dto, user.sub);
  }

  @Patch(':id')
  updateDraft(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
  ) {
    return this.campaigns.updateCreatorDraft(user.sub, id, dto);
  }

  @Post(':id/submit')
  submitForReview(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.submitForReview(user.sub, id);
  }

  @Get(':id/stats')
  getStats(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.campaigns.getCreatorCampaignStats(user.sub, id);
  }

  @Get(':id/buyers')
  getBuyers(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Query() query: CampaignBuyersQueryDto,
  ) {
    return this.campaigns.getCreatorCampaignBuyers(user.sub, id, query);
  }

  @Get(':id/exports.xlsx')
  async exportXlsx(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportCreatorCampaignXlsx(
      user.sub,
      id,
    );

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Get(':id/exports.pdf')
  async exportPdf(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const file = await this.exportsService.exportCreatorCampaignPdf(
      user.sub,
      id,
    );

    res.setHeader('Content-Type', file.contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${file.fileName}"`,
    );
    res.send(file.buffer);
  }

  @Patch(':id/links')
  updateLinks(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() body: { youtube?: string; facebook?: string },
  ) {
    return this.campaigns.updateLinks(user.sub, id, body);
  }
}
