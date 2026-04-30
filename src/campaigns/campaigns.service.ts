import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignStatus } from '@prisma/client';
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
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  findAdminList() {
    return this.prisma.campaign.findMany({
      orderBy: {
        createdAt: 'desc',
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
