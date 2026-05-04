import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CampaignStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let prisma: {
    campaign: {
      create: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      campaign: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditService,
          useValue: {
            log: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('5000'),
          },
        },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects campaigns above the configured ticket cap', async () => {
    await expect(
      service.create({
        title: 'Big Campaign',
        ticketPrice: 100,
        totalTickets: 5001,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('blocks invalid admin status transitions', async () => {
    prisma.campaign.findUnique.mockResolvedValue({
      id: 'campaign-1',
      status: CampaignStatus.DRAWN,
      creatorId: 'creator-1',
    });

    await expect(
      service.updateStatus('campaign-1', CampaignStatus.ACTIVE, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
