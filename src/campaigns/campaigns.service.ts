import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Campaign,
  CampaignStatus,
  Prisma,
  TicketStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async create(dto: CreateCampaignDto) {
    const campaign = await this.prisma.campaign.create({
      data: {
        title: dto.title,
        description: dto.description,
        imageUrl: dto.imageUrl,
        ticketPrice: dto.ticketPrice,
        totalTickets: dto.totalTickets,
        drawAt: dto.drawAt ? new Date(dto.drawAt) : null,
        status: CampaignStatus.DRAFT,
        creatorId: dto.creatorId,
      },
    });

    await this.audit.log(
      null, // Actor will be handled by controller if needed
      'CAMPAIGN_CREATED',
      'Campaign',
      campaign.id,
      { title: campaign.title }
    );

    return campaign;
  }

  findActive() {
    return this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.ACTIVE,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getCampaignTicketSummary(campaignId: string) {
    const [totalTickets, taken] = await Promise.all([
      this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { totalTickets: true },
      }),
      this.prisma.ticket.count({
        where: {
          campaignId,
          status: { in: [TicketStatus.PAID, TicketStatus.WINNER, TicketStatus.RESERVED, TicketStatus.PAYMENT_PENDING] },
        },
      }),
    ]);

    const counts = await this.prisma.ticket.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: true,
    });

    const statusCounts = counts.reduce((acc, curr) => {
      acc[curr.status] = curr._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      campaignId,
      totalTickets: totalTickets?.totalTickets || 0,
      taken,
      remaining: (totalTickets?.totalTickets || 0) - taken,
      counts: statusCounts,
    };
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            bio: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  findAdminList() {
    return this.prisma.campaign.findMany({
      include: {
        creator: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findByCreator(creatorId: string) {
    return this.prisma.campaign.findMany({
      where: { creatorId },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateLinks(id: string, links: { youtube?: string; facebook?: string }) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        liveLinks: links as any,
      },
    });
  }

  async updateStatus(id: string, status: CampaignStatus) {
    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status },
    });

    await this.audit.log(
      null,
      'CAMPAIGN_STATUS_UPDATED',
      'Campaign',
      campaign.id,
      { status }
    );

    return campaign;
  }
}
