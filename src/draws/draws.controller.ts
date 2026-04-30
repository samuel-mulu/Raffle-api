import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { DrawsService } from './draws.service';
import { RunDrawDto } from './dto/run-draw.dto';

@Controller()
export class DrawsController {
  constructor(private readonly draws: DrawsService) {}

  @Get('campaigns/:campaignId/winners')
  async getWinners(@Param('campaignId') campaignId: string) {
    const winners = await this.draws.getWinners(campaignId);
    // Sanitize user data
    return winners.map((w) => ({
      prizeRank: w.prizeRank,
      ticketNumber: w.ticket.ticketNumber,
      user: w.ticket.user ? {
        phone: w.ticket.user.phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2'),
      } : null,
    }));
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/campaigns/:campaignId/run-draw')
  runDraw(
    @CurrentUser() user: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: RunDrawDto,
  ) {
    return this.draws.runDraw(user.sub, campaignId, dto.winnerCount);
  }
}
