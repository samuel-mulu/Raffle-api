import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class DrawsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async runDraw(adminId: string, campaignId: string, winnerCount = 3) {
    return this.prisma.$transaction(async (tx) => {
      const campaign = await tx.campaign.findUnique({
        where: { id: campaignId },
      });

      if (!campaign) throw new NotFoundException('Campaign not found');

      if (campaign.status !== CampaignStatus.LOCKED) {
        throw new BadRequestException('Campaign must be locked before draw');
      }

      const existingWinners = await tx.winner.count({
        where: { campaignId },
      });

      if (existingWinners > 0) {
        throw new BadRequestException('Draw already completed');
      }

      const paidTickets = await tx.ticket.findMany({
        where: {
          campaignId,
          status: TicketStatus.PAID,
        },
        orderBy: {
          ticketNumber: 'asc',
        },
      });

      if (paidTickets.length < winnerCount) {
        throw new BadRequestException('Not enough paid tickets');
      }

      const selected = this.pickWinners(paidTickets, winnerCount);

      const winners: any[] = [];

      for (let i = 0; i < selected.length; i++) {
        const winner = await tx.winner.create({
          data: {
            campaignId,
            ticketId: selected[i].id,
            prizeRank: i + 1,
          },
          include: {
            ticket: {
              include: {
                user: true,
              },
            },
          },
        });

        await tx.ticket.update({
          where: { id: selected[i].id },
          data: { status: TicketStatus.WINNER },
        });

        winners.push(winner);
      }

      await tx.campaign.update({
        where: { id: campaignId },
        data: { status: CampaignStatus.DRAWN },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'DRAW_RUN',
          entity: 'Campaign',
          entityId: campaignId,
          metadata: {
            winnerCount,
            paidTicketCount: paidTickets.length,
            winningTicketNumbers: selected.map((t) => t.ticketNumber),
          },
        },
      });

      return {
        campaignId,
        paidTicketCount: paidTickets.length,
        winners,
      };
    });
  }

  private pickWinners<T>(items: T[], count: number): T[] {
    const copy = [...items];

    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy.slice(0, count);
  }

  getWinners(campaignId: string) {
    return this.prisma.winner.findMany({
      where: { campaignId },
      include: {
        ticket: {
          include: {
            user: true,
          },
        },
      },
      orderBy: {
        prizeRank: 'asc',
      },
    });
  }
}
