import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { ReserveTicketDto } from './dto/reserve-ticket.dto';
import { TicketsService } from './tickets.service';

@Controller()
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get('campaigns/:campaignId/tickets/summary')
  getCampaignTicketSummary(@Param('campaignId') campaignId: string) {
    return this.tickets.getCampaignTicketSummary(campaignId);
  }

  @Get('campaigns/:campaignId/tickets/taken')
  getTakenTickets(@Param('campaignId') campaignId: string) {
    return this.tickets.getTakenTickets(campaignId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('campaigns/:campaignId/tickets/reserve')
  reserveTicket(
    @CurrentUser() user: any,
    @Param('campaignId') campaignId: string,
    @Body() dto: ReserveTicketDto,
  ) {
    return this.tickets.reserveTicket(
      user.sub,
      campaignId,
      dto.ticketNumber,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/tickets')
  myTickets(@CurrentUser() user: any) {
    return this.tickets.myTickets(user.sub);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/tickets/expire-reservations')
  cleanupExpiredReservations() {
    return this.tickets.cleanupExpiredReservations();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/campaigns/:campaignId/tickets/expire-reservations')
  cleanupCampaignExpiredReservations(@Param('campaignId') campaignId: string) {
    return this.tickets.cleanupExpiredReservations(campaignId);
  }
}
