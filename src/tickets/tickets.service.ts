import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, Prisma, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async reserveTicket(userId: string, campaignId: string, ticketNumber: number) {
    const reservedUntil = new Date(Date.now() + 5 * 60 * 1000);

    try {
      const ticket = await this.prisma.$transaction(async (tx) => {
        // Step 2: Auto-clean expired reservations for this campaign before trying to reserve
        await tx.ticket.deleteMany({
          where: {
            campaignId,
            status: TicketStatus.RESERVED,
            reservedUntil: {
              lt: new Date(),
            },
          },
        });

        const campaign = await tx.campaign.findUnique({
          where: { id: campaignId },
        });

        if (!campaign) {
          throw new NotFoundException('Campaign not found');
        }

        if (campaign.status !== CampaignStatus.ACTIVE) {
          throw new BadRequestException('Campaign is not active');
        }

        if (ticketNumber < 1 || ticketNumber > campaign.totalTickets) {
          throw new BadRequestException('Invalid ticket number');
        }

        const newTicket = await tx.ticket.create({
          data: {
            campaignId,
            userId,
            ticketNumber,
            status: TicketStatus.RESERVED,
            reservedUntil,
          },
        });

        return newTicket;
      });

      await this.audit.log(
        userId,
        'TICKET_RESERVED',
        'Ticket',
        ticket.id,
        { campaignId, ticketNumber }
      );

      return ticket;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('This ticket number is already taken');
      }

      throw error;
    }
  }

  async findOne(id: string, userId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        campaign: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.userId !== userId) {
      throw new BadRequestException('You do not have access to this ticket');
    }

    return ticket;
  }

  myTickets(userId: string) {
    return this.prisma.ticket.findMany({
      where: { userId },
      include: {
        campaign: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getCampaignTicketSummary(campaignId: string) {
    // Step 4: Clean up before generating summary
    await this.cleanupExpiredReservations(campaignId);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const grouped = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const counts = grouped.reduce(
      (acc, item) => {
        acc[item.status] = item._count;
        return acc;
      },
      {} as Record<string, number>,
    );

    const taken =
      (counts.RESERVED ?? 0) +
      (counts.PAYMENT_PENDING ?? 0) +
      (counts.PAID ?? 0) +
      (counts.WINNER ?? 0);

    return {
      campaignId,
      totalTickets: campaign.totalTickets,
      taken,
      remaining: campaign.totalTickets - taken,
      counts,
    };
  }

  async getTakenTickets(campaignId: string) {
    // Clean expired first
    await this.cleanupExpiredReservations(campaignId);

    const tickets = await this.prisma.ticket.findMany({
      where: {
        campaignId,
        status: {
          in: [
            TicketStatus.RESERVED,
            TicketStatus.PAYMENT_PENDING,
            TicketStatus.PAID,
            TicketStatus.WINNER,
          ],
        },
      },
      select: {
        ticketNumber: true,
      },
    });

    return {
      campaignId,
      takenNumbers: tickets.map((t) => t.ticketNumber),
    };
  }

  async cleanupExpiredReservations(campaignId?: string) {
    const where = {
      status: TicketStatus.RESERVED,
      reservedUntil: {
        lt: new Date(),
      },
      ...(campaignId ? { campaignId } : {}),
    };

    const expiredTickets = await this.prisma.ticket.findMany({
      where,
      select: {
        id: true,
        campaignId: true,
        ticketNumber: true,
        userId: true,
      },
    });

    if (expiredTickets.length === 0) {
      return {
        expired: 0,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const ticket of expiredTickets) {
        await tx.auditLog.create({
          data: {
            actorId: ticket.userId,
            action: 'TICKET_RESERVATION_EXPIRED',
            entity: 'Ticket',
            entityId: ticket.id,
            metadata: {
              campaignId: ticket.campaignId,
              ticketNumber: ticket.ticketNumber,
            },
          },
        });
      }

      await tx.ticket.deleteMany({
        where: {
          id: {
            in: expiredTickets.map((ticket) => ticket.id),
          },
        },
      });
    });

    return {
      expired: expiredTickets.length,
    };
  }
}
