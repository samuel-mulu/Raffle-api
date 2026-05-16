import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CampaignStatus,
  PaymentStatus,
  Prisma,
  TicketStatus,
} from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { maskPhone } from '../common/utils/phone.util';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignBuyersQueryDto } from './dto/campaign-buyers-query.dto';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto } from './dto/update-campaign.dto';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private config: ConfigService,
  ) {}

  async create(dto: CreateCampaignDto, actorId: string | null = null) {
    this.assertTicketCountWithinLimit(dto.totalTickets);

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
      actorId ?? dto.creatorId ?? null,
      'CAMPAIGN_CREATED',
      'Campaign',
      campaign.id,
      { title: campaign.title },
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

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: {
        id,
        status: {
          in: [
            CampaignStatus.ACTIVE,
            CampaignStatus.LOCKED,
            CampaignStatus.DRAWN,
            CampaignStatus.COMPLETED,
          ],
        },
      },
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

  async findAnyById(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            bio: true,
            phone: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async getCampaignTicketSummary(campaignId: string) {
    const summary = await this.buildCampaignAnalytics(campaignId);

    return {
      campaignId: summary.campaignId,
      totalTickets: summary.totalTickets,
      taken: summary.taken,
      remaining: summary.remaining,
      counts: summary.counts,
    };
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

  findReviewQueue() {
    return this.prisma.campaign.findMany({
      where: {
        status: CampaignStatus.PENDING_APPROVAL,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  findByCreator(creatorId: string) {
    return this.prisma.campaign.findMany({
      where: { creatorId },
      include: {
        _count: {
          select: {
            tickets: true,
            payments: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateCreatorDraft(
    creatorId: string,
    id: string,
    dto: UpdateCampaignDto,
  ) {
    const campaign = await this.findCreatorCampaign(creatorId, id);
    const editableStatuses: CampaignStatus[] = [
      CampaignStatus.DRAFT,
      CampaignStatus.REJECTED,
    ];

    if (!editableStatuses.includes(campaign.status)) {
      throw new BadRequestException(
        'Only draft or rejected campaigns can be edited',
      );
    }

    if (typeof dto.totalTickets !== 'undefined') {
      this.assertTicketCountWithinLimit(dto.totalTickets);
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: this.buildCampaignUpdateData(dto),
    });

    await this.audit.log(creatorId, 'CAMPAIGN_UPDATED', 'Campaign', id, {
      fields: Object.keys(dto),
    });

    return updated;
  }

  async submitForReview(creatorId: string, id: string) {
    const campaign = await this.findCreatorCampaign(creatorId, id);
    const submittableStatuses: CampaignStatus[] = [
      CampaignStatus.DRAFT,
      CampaignStatus.REJECTED,
    ];

    if (!submittableStatuses.includes(campaign.status)) {
      throw new BadRequestException(
        'Only draft or rejected campaigns can be submitted',
      );
    }

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: { status: CampaignStatus.PENDING_APPROVAL },
    });

    await this.audit.log(
      creatorId,
      'CAMPAIGN_SUBMITTED_FOR_REVIEW',
      'Campaign',
      id,
      {
        previousStatus: campaign.status,
        nextStatus: CampaignStatus.PENDING_APPROVAL,
      },
    );

    return updated;
  }

  async getCreatorCampaignStats(creatorId: string, id: string) {
    await this.findCreatorCampaign(creatorId, id);
    return this.buildCampaignAnalytics(id);
  }

  async getCreatorCampaignBuyers(
    creatorId: string,
    id: string,
    query: CampaignBuyersQueryDto,
  ) {
    await this.findCreatorCampaign(creatorId, id);
    return this.getCampaignBuyerList(id, query, true);
  }

  async assertCreatorCampaign(creatorId: string, campaignId: string) {
    await this.findCreatorCampaign(creatorId, campaignId);
  }

  async getAdminCampaignBuyers(id: string, query: CampaignBuyersQueryDto) {
    await this.findAnyById(id);
    return this.getCampaignBuyerList(id, query, true);
  }

  async getExportDataForCreator(creatorId: string, id: string) {
    await this.findCreatorCampaign(creatorId, id);
    return this.buildCampaignExportData(id);
  }

  async getExportDataForAdmin(id: string) {
    await this.findAnyById(id);
    return this.buildCampaignExportData(id);
  }

  async updateLinks(
    creatorId: string,
    id: string,
    links: { youtube?: string; facebook?: string },
  ) {
    await this.findCreatorCampaign(creatorId, id);

    const updated = await this.prisma.campaign.update({
      where: { id },
      data: {
        liveLinks: links,
      },
    });

    await this.audit.log(creatorId, 'CAMPAIGN_LINKS_UPDATED', 'Campaign', id, {
      links,
    });

    return updated;
  }

  async updateStatus(
    id: string,
    status: CampaignStatus,
    actorId: string | null = null,
  ) {
    const current = await this.findAnyById(id);

    if (current.status === status) {
      return current;
    }

    const allowedTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      [CampaignStatus.DRAFT]: [
        CampaignStatus.PENDING_APPROVAL,
        CampaignStatus.ACTIVE,
        CampaignStatus.CANCELLED,
      ],
      [CampaignStatus.PENDING_APPROVAL]: [
        CampaignStatus.ACTIVE,
        CampaignStatus.REJECTED,
        CampaignStatus.DRAFT,
        CampaignStatus.CANCELLED,
      ],
      [CampaignStatus.ACTIVE]: [
        CampaignStatus.LOCKED,
        CampaignStatus.CANCELLED,
      ],
      [CampaignStatus.LOCKED]: [CampaignStatus.DRAWN, CampaignStatus.CANCELLED],
      [CampaignStatus.DRAWN]: [CampaignStatus.COMPLETED],
      [CampaignStatus.COMPLETED]: [],
      [CampaignStatus.CANCELLED]: [],
      [CampaignStatus.REJECTED]: [
        CampaignStatus.DRAFT,
        CampaignStatus.CANCELLED,
      ],
    };

    if (!allowedTransitions[current.status].includes(status)) {
      throw new BadRequestException(
        `Cannot move campaign from ${current.status} to ${status}`,
      );
    }

    const campaign = await this.prisma.campaign.update({
      where: { id },
      data: { status },
    });

    await this.audit.log(
      actorId,
      'CAMPAIGN_STATUS_UPDATED',
      'Campaign',
      campaign.id,
      {
        previousStatus: current.status,
        status,
      },
    );

    return campaign;
  }

  private async findCreatorCampaign(creatorId: string, id: string) {
    const campaign = await this.findAnyById(id);

    if (campaign.creatorId !== creatorId) {
      throw new BadRequestException('You do not own this campaign');
    }

    return campaign;
  }

  private buildCampaignUpdateData(dto: UpdateCampaignDto) {
    const data: Prisma.CampaignUpdateInput = {};

    if (typeof dto.title !== 'undefined') {
      data.title = dto.title;
    }

    if (typeof dto.description !== 'undefined') {
      data.description = dto.description;
    }

    if (typeof dto.imageUrl !== 'undefined') {
      data.imageUrl = dto.imageUrl;
    }

    if (typeof dto.ticketPrice !== 'undefined') {
      data.ticketPrice = dto.ticketPrice;
    }

    if (typeof dto.totalTickets !== 'undefined') {
      data.totalTickets = dto.totalTickets;
    }

    if (typeof dto.drawAt !== 'undefined') {
      data.drawAt = new Date(dto.drawAt);
    }

    return data;
  }

  private getMaxTicketCount() {
    const raw = this.config.get<string>('CAMPAIGN_MAX_TICKETS');
    const parsed = Number(raw ?? 5000);

    if (!Number.isFinite(parsed) || parsed < 1) {
      return 5000;
    }

    return parsed;
  }

  private assertTicketCountWithinLimit(totalTickets: number) {
    const max = this.getMaxTicketCount();

    if (totalTickets > max) {
      throw new BadRequestException(
        `Campaign totalTickets cannot exceed ${max}`,
      );
    }
  }

  private async getCampaignBuyerList(
    campaignId: string,
    query: CampaignBuyersQueryDto,
    includeFullPhone: boolean,
  ) {
    await this.cleanupExpiredReservations(campaignId);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();

    const where: Prisma.TicketWhereInput = {
      campaignId,
      userId: { not: null },
    };

    if (query.ticketStatus) {
      where.status = query.ticketStatus;
    } else if (query.approvedOnly) {
      where.status = {
        in: [TicketStatus.PAID, TicketStatus.WINNER],
      };
    }

    if (query.paymentStatus) {
      where.payment = {
        is: {
          status: query.paymentStatus,
        },
      };
    }

    if (search) {
      const numericSearch = Number(search);
      where.OR = [
        {
          user: {
            is: {
              phone: {
                contains: search,
              },
            },
          },
        },
        {
          user: {
            is: {
              name: {
                contains: search,
                mode: 'insensitive',
              },
            },
          },
        },
      ];

      if (Number.isInteger(numericSearch)) {
        where.OR.push({
          ticketNumber: numericSearch,
        });
      }
    }

    const [total, tickets, summary] = await Promise.all([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              phone: true,
              avatarUrl: true,
            },
          },
          payment: true,
          winner: true,
        },
        orderBy: [{ ticketNumber: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.buildCampaignAnalytics(campaignId),
    ]);

    return {
      campaignId,
      page,
      pageSize,
      total,
      summary,
      items: tickets.map((ticket) => ({
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketStatus: ticket.status,
        reservedUntil: ticket.reservedUntil,
        paidAt: ticket.paidAt,
        createdAt: ticket.createdAt,
        payment: ticket.payment
          ? {
              id: ticket.payment.id,
              status: ticket.payment.status,
              amount: ticket.payment.amount,
              transactionId: ticket.payment.transactionId,
              proofUrl: ticket.payment.proofUrl,
              approvedAt: ticket.payment.approvedAt,
            }
          : null,
        buyer: ticket.user
          ? {
              id: ticket.user.id,
              name: ticket.user.name,
              avatarUrl: ticket.user.avatarUrl,
              phone: includeFullPhone
                ? ticket.user.phone
                : maskPhone(ticket.user.phone),
            }
          : null,
        winner: ticket.winner
          ? {
              prizeRank: ticket.winner.prizeRank,
            }
          : null,
      })),
    };
  }

  private async buildCampaignAnalytics(campaignId: string) {
    await this.cleanupExpiredReservations(campaignId);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        title: true,
        status: true,
        totalTickets: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const [ticketGroups, paymentGroups, expiredReservations] = await Promise.all([
      this.prisma.ticket.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: true,
      }),
      this.prisma.payment.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: true,
      }),
      this.prisma.auditLog.findMany({
        where: {
          action: 'TICKET_RESERVATION_EXPIRED',
          entity: 'Ticket',
          metadata: {
            path: ['campaignId'],
            equals: campaignId,
          },
        },
        select: { id: true },
      }),
    ]);

    const counts = {
      [TicketStatus.RESERVED]: 0,
      [TicketStatus.PAYMENT_PENDING]: 0,
      [TicketStatus.PAID]: 0,
      [TicketStatus.EXPIRED]: 0,
      [TicketStatus.CANCELLED]: 0,
      [TicketStatus.WINNER]: 0,
    } as Record<TicketStatus, number>;

    ticketGroups.forEach((group) => {
      counts[group.status] = group._count;
    });

    const paymentCounts = {
      [PaymentStatus.PENDING]: 0,
      [PaymentStatus.APPROVED]: 0,
      [PaymentStatus.REJECTED]: 0,
    } as Record<PaymentStatus, number>;

    paymentGroups.forEach((group) => {
      paymentCounts[group.status] = group._count;
    });

    const sold = counts[TicketStatus.PAID] + counts[TicketStatus.WINNER];
    const taken =
      sold +
      counts[TicketStatus.RESERVED] +
      counts[TicketStatus.PAYMENT_PENDING];

    return {
      campaignId: campaign.id,
      title: campaign.title,
      status: campaign.status,
      totalTickets: campaign.totalTickets,
      sold,
      taken,
      remaining: campaign.totalTickets - taken,
      counts,
      paymentCounts,
      expiredReservations: expiredReservations.length,
    };
  }

  private async buildCampaignExportData(campaignId: string) {
    await this.cleanupExpiredReservations(campaignId);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        tickets: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                phone: true,
                avatarUrl: true,
              },
            },
            payment: true,
            winner: true,
          },
          orderBy: {
            ticketNumber: 'asc',
          },
        },
        winners: {
          include: {
            ticket: {
              include: {
                user: {
                  select: {
                    name: true,
                    phone: true,
                  },
                },
              },
            },
          },
          orderBy: {
            prizeRank: 'asc',
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const summary = await this.buildCampaignAnalytics(campaignId);

    return {
      campaign: {
        id: campaign.id,
        title: campaign.title,
        description: campaign.description,
        status: campaign.status,
        ticketPrice: campaign.ticketPrice,
        totalTickets: campaign.totalTickets,
        drawAt: campaign.drawAt,
        createdAt: campaign.createdAt,
        creator: campaign.creator,
      },
      summary,
      rows: campaign.tickets.map((ticket) => ({
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        ticketStatus: ticket.status,
        reservedUntil: ticket.reservedUntil,
        paidAt: ticket.paidAt,
        createdAt: ticket.createdAt,
        paymentStatus: ticket.payment?.status ?? null,
        amount: ticket.payment?.amount ?? null,
        transactionId: ticket.payment?.transactionId ?? null,
        approvedAt: ticket.payment?.approvedAt ?? null,
        buyerId: ticket.user?.id ?? null,
        buyerName: ticket.user?.name ?? null,
        buyerPhone: ticket.user?.phone ?? null,
        proofUrl: ticket.payment?.proofUrl ?? null,
        prizeRank: ticket.winner?.prizeRank ?? null,
      })),
      winners: campaign.winners.map((winner) => ({
        prizeRank: winner.prizeRank,
        ticketNumber: winner.ticket.ticketNumber,
        buyerName: winner.ticket.user?.name ?? null,
        buyerPhone: winner.ticket.user?.phone ?? null,
      })),
    };
  }

  private async cleanupExpiredReservations(campaignId: string) {
    const expiredTickets = await this.prisma.ticket.findMany({
      where: {
        campaignId,
        status: TicketStatus.RESERVED,
        reservedUntil: {
          lt: new Date(),
        },
      },
      select: {
        id: true,
        campaignId: true,
        ticketNumber: true,
        userId: true,
      },
    });

    if (expiredTickets.length === 0) {
      return;
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
  }
}
