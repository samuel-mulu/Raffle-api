import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, createHmac, randomBytes } from 'crypto';
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

      const drawMetadata = this.buildDrawMetadata(paidTickets);
      const selected = this.pickWinners(
        paidTickets,
        winnerCount,
        drawMetadata.seed,
      );

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
            seed: drawMetadata.seed,
            participantHash: drawMetadata.participantHash,
            algorithm: drawMetadata.algorithm,
          },
        },
      });

      return {
        campaignId,
        paidTicketCount: paidTickets.length,
        winners,
        draw: {
          seed: drawMetadata.seed,
          participantHash: drawMetadata.participantHash,
          algorithm: drawMetadata.algorithm,
        },
      };
    });
  }

  private buildDrawMetadata(
    items: Array<{ id: string; ticketNumber: number; userId: string | null }>,
  ) {
    const participantHash = createHash('sha256')
      .update(
        JSON.stringify(
          items.map((item) => ({
            id: item.id,
            ticketNumber: item.ticketNumber,
            userId: item.userId,
          })),
        ),
      )
      .digest('hex');

    return {
      seed: randomBytes(32).toString('hex'),
      participantHash,
      algorithm: 'hmac-sha256-ticket-order-v1',
    };
  }

  private pickWinners<T extends { id: string; ticketNumber: number }>(
    items: T[],
    count: number,
    seed: string,
  ): T[] {
    const copy = [...items];

    copy.sort((a, b) => {
      const aScore = this.drawScore(seed, a);
      const bScore = this.drawScore(seed, b);
      return aScore.localeCompare(bScore);
    });

    return copy.slice(0, count);
  }

  private drawScore(
    seed: string,
    item: {
      id: string;
      ticketNumber: number;
    },
  ) {
    return createHmac('sha256', seed)
      .update(`${item.id}:${item.ticketNumber}`)
      .digest('hex');
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
