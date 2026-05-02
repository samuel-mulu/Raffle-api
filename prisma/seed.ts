import 'dotenv/config';
import {
  CampaignStatus,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
  TicketStatus,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

function daysFromNow(days: number) {
  return new Date(Date.now() + days * DAY);
}

function hoursFromNow(hours: number) {
  return new Date(Date.now() + hours * HOUR);
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * DAY);
}

type SeedUser = {
  id: string;
  phone: string;
  role: Role;
};

type SeedCampaign = {
  id: string;
  title: string;
  ticketPrice: number;
  totalTickets: number;
  status: CampaignStatus;
};

type PaymentSeedInput = {
  buyer: SeedUser;
  campaign: SeedCampaign;
  ticketNumber: number;
  transactionId?: string;
  proofUrl?: string;
  reservedUntil?: Date | null;
  paidAt?: Date | null;
  paymentStatus?: PaymentStatus | null;
  approvedAt?: Date | null;
  ticketStatus: TicketStatus;
};

async function createUser(phone: string, role: Role) {
  return prisma.user.create({
    data: {
      phone,
      role,
    },
  });
}

async function createCampaign(data: {
  title: string;
  description: string;
  imageUrl?: string;
  ticketPrice: number;
  totalTickets: number;
  status: CampaignStatus;
  drawAt?: Date | null;
  liveLinks?: Prisma.InputJsonObject;
  creatorId?: string;
}) {
  const { liveLinks, ...campaignData } = data;

  return prisma.campaign.create({
    data: {
      ...campaignData,
      creatorId: data.creatorId,
      ...(typeof liveLinks !== 'undefined' ? { liveLinks } : {}),
    },
  });
}

async function createTicketScenario(input: PaymentSeedInput) {
  const ticket = await prisma.ticket.create({
    data: {
      campaignId: input.campaign.id,
      userId: input.buyer.id,
      ticketNumber: input.ticketNumber,
      status: input.ticketStatus,
      reservedUntil: input.reservedUntil ?? null,
      paidAt: input.paidAt ?? null,
    },
  });

  if (input.paymentStatus) {
    await prisma.payment.create({
      data: {
        campaignId: input.campaign.id,
        ticketId: ticket.id,
        userId: input.buyer.id,
        amount: input.campaign.ticketPrice,
        transactionId: input.transactionId ?? null,
        proofUrl: input.proofUrl ?? null,
        status: input.paymentStatus,
        approvedAt: input.approvedAt ?? null,
      },
    });
  }

  return { ticket };
}

async function markWinner(campaignId: string, ticketId: string, prizeRank: number) {
  await prisma.winner.create({
    data: {
      campaignId,
      ticketId,
      prizeRank,
    },
  });

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: TicketStatus.WINNER },
  });
}

async function addAuditLogs(admins: SeedUser[], campaigns: SeedCampaign[]) {
  const [admin1, admin2] = admins;

  const actions = [
    {
      actorId: admin1.id,
      action: 'CAMPAIGN_CREATED',
      entity: 'Campaign',
      entityId: campaigns[0].id,
      metadata: { title: campaigns[0].title, status: campaigns[0].status },
    },
    {
      actorId: admin1.id,
      action: 'CAMPAIGN_CREATED',
      entity: 'Campaign',
      entityId: campaigns[1].id,
      metadata: { title: campaigns[1].title, status: campaigns[1].status },
    },
    {
      actorId: admin2.id,
      action: 'CAMPAIGN_STATUS_UPDATED',
      entity: 'Campaign',
      entityId: campaigns[3].id,
      metadata: { status: CampaignStatus.LOCKED },
    },
    {
      actorId: admin2.id,
      action: 'PAYMENT_APPROVED',
      entity: 'Payment',
      metadata: { campaignTitle: campaigns[0].title, amount: campaigns[0].ticketPrice },
    },
    {
      actorId: admin1.id,
      action: 'PAYMENT_REJECTED',
      entity: 'Payment',
      metadata: { campaignTitle: campaigns[1].title, amount: campaigns[1].ticketPrice },
    },
    {
      actorId: admin2.id,
      action: 'DRAW_RUN',
      entity: 'Campaign',
      entityId: campaigns[4].id,
      metadata: { campaignTitle: campaigns[4].title, winnerCount: 3 },
    },
    {
      actorId: admin1.id,
      action: 'DRAW_RUN',
      entity: 'Campaign',
      entityId: campaigns[5].id,
      metadata: { campaignTitle: campaigns[5].title, winnerCount: 2 },
    },
  ];

  await prisma.auditLog.createMany({
    data: actions,
  });
}

async function main() {
  console.log('Starting seed...');

  console.log('Cleaning existing data...');
  await prisma.winner.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.campaign.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();

  console.log('Creating users...');
  const admins = await Promise.all([
    createUser('+251911000001', Role.ADMIN),
    createUser('+251911000002', Role.ADMIN),
  ]);

  const creators = await Promise.all([
    createUser('+251922000001', Role.CREATOR),
  ]);

  const buyers = await Promise.all([
    createUser('+251911000003', Role.USER),
    createUser('+251911000004', Role.USER),
    createUser('+251911000005', Role.USER),
    createUser('+251911000006', Role.USER),
    createUser('+251911000007', Role.USER),
    createUser('+251911000008', Role.USER),
    createUser('+251911000009', Role.USER),
    createUser('+251911000010', Role.USER),
    createUser('+251911000011', Role.USER),
    createUser('+251911000012', Role.USER),
    createUser('+251911000013', Role.USER),
    createUser('+251911000014', Role.USER),
    createUser('+251911000015', Role.USER),
  ]);

  console.log(`Created ${admins.length} admins and ${buyers.length} buyers`);

  console.log('Creating campaigns...');
  const campaigns = await Promise.all([
    createCampaign({
      title: 'Samsung 65-inch 4K TV Giveaway',
      description:
        'A clean active campaign for frontend reservation testing. Most numbers are still free so you can reserve, pay, and see the full buyer flow.',
      imageUrl:
        'https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=1200',
      ticketPrice: 80,
      totalTickets: 120,
      status: CampaignStatus.ACTIVE,
      drawAt: daysFromNow(12),
      liveLinks: {
        youtube: 'https://youtube.com/live/tv-demo',
      },
      creatorId: creators[0].id,
    }),
    createCampaign({
      title: 'Luxury Apartment Raffle',
      description:
        'A busier active campaign with a good mix of paid, reserved, pending, and rejected buyer journeys.',
      imageUrl:
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200',
      ticketPrice: 500,
      totalTickets: 1000,
      status: CampaignStatus.ACTIVE,
      drawAt: daysFromNow(30),
      liveLinks: {
        youtube: 'https://youtube.com/live/apartment-demo',
        facebook: 'https://facebook.com/live/apartment-demo',
      },
    }),
    createCampaign({
      title: 'Brand New Toyota Land Cruiser',
      description:
        'Another active campaign seeded with multiple pending payments for admin review testing.',
      imageUrl:
        'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=1200',
      ticketPrice: 300,
      totalTickets: 500,
      status: CampaignStatus.ACTIVE,
      drawAt: daysFromNow(15),
    }),
    createCampaign({
      title: 'iPhone 15 Pro Max Bundle',
      description:
        'This campaign is locked and already has enough paid tickets, so an admin can run the draw immediately.',
      imageUrl:
        'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1200',
      ticketPrice: 100,
      totalTickets: 200,
      status: CampaignStatus.LOCKED,
      drawAt: daysFromNow(7),
      liveLinks: {
        youtube: 'https://youtube.com/live/iphone-draw',
      },
    }),
    createCampaign({
      title: 'Cash Prize 100,000 ETB',
      description:
        'A drawn campaign with published winners and remaining paid tickets so the winners page looks realistic.',
      imageUrl:
        'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1200',
      ticketPrice: 200,
      totalTickets: 800,
      status: CampaignStatus.DRAWN,
      drawAt: daysAgo(5),
    }),
    createCampaign({
      title: 'Vacation Package to Dubai',
      description:
        'A completed campaign seeded with historical winners for archive-style winner views.',
      imageUrl:
        'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200',
      ticketPrice: 150,
      totalTickets: 300,
      status: CampaignStatus.COMPLETED,
      drawAt: daysAgo(20),
    }),
    createCampaign({
      title: 'Beachfront Plot Raffle',
      description:
        'Draft campaign that is visible to admin users but not to public buyers yet.',
      imageUrl:
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200',
      ticketPrice: 700,
      totalTickets: 400,
      status: CampaignStatus.DRAFT,
      drawAt: daysFromNow(60),
    }),
    createCampaign({
      title: 'MacBook Pro Creator Bundle',
      description:
        'Pending approval campaign to show a not-yet-live state in the admin area.',
      imageUrl:
        'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?w=1200',
      ticketPrice: 250,
      totalTickets: 180,
      status: CampaignStatus.PENDING_APPROVAL,
      drawAt: daysFromNow(25),
    }),
    createCampaign({
      title: 'Electric Scooter City Giveaway',
      description:
        'Cancelled campaign kept in the seed so admin users can verify lifecycle edge cases.',
      imageUrl:
        'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=1200',
      ticketPrice: 90,
      totalTickets: 220,
      status: CampaignStatus.CANCELLED,
      drawAt: daysAgo(2),
    }),
  ]);

  const [
    activeFreshCampaign,
    activeBusyCampaign,
    activePendingCampaign,
    lockedDrawCampaign,
    drawnCampaign,
    completedCampaign,
  ] = campaigns;

  console.log(`Created ${campaigns.length} campaigns`);

  console.log('Creating active campaign demo data...');
  await createTicketScenario({
    buyer: buyers[0],
    campaign: activeFreshCampaign,
    ticketNumber: 3,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'TV-0003',
    proofUrl: 'https://imgur.com/tv-0003.png',
    paidAt: daysAgo(1),
    approvedAt: daysAgo(1),
  });
  await createTicketScenario({
    buyer: buyers[3],
    campaign: activeFreshCampaign,
    ticketNumber: 9,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'TV-0009',
    proofUrl: 'https://imgur.com/tv-0009.png',
    paidAt: daysAgo(2),
    approvedAt: daysAgo(2),
  });
  await createTicketScenario({
    buyer: buyers[2],
    campaign: activeFreshCampaign,
    ticketNumber: 15,
    ticketStatus: TicketStatus.RESERVED,
    reservedUntil: hoursFromNow(36),
  });
  await createTicketScenario({
    buyer: buyers[1],
    campaign: activeFreshCampaign,
    ticketNumber: 21,
    ticketStatus: TicketStatus.PAYMENT_PENDING,
    paymentStatus: PaymentStatus.PENDING,
    transactionId: 'TV-0021',
    proofUrl: 'https://imgur.com/tv-0021.png',
    reservedUntil: hoursFromNow(36),
  });
  await createTicketScenario({
    buyer: buyers[4],
    campaign: activeFreshCampaign,
    ticketNumber: 11,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'TV-0011',
    proofUrl: 'https://imgur.com/tv-0011.png',
    paidAt: daysAgo(1),
    approvedAt: daysAgo(1),
  });
  await createTicketScenario({
    buyer: buyers[6],
    campaign: activeFreshCampaign,
    ticketNumber: 18,
    ticketStatus: TicketStatus.RESERVED,
    reservedUntil: hoursFromNow(30),
  });
  await createTicketScenario({
    buyer: buyers[12],
    campaign: activeFreshCampaign,
    ticketNumber: 24,
    ticketStatus: TicketStatus.PAYMENT_PENDING,
    paymentStatus: PaymentStatus.PENDING,
    transactionId: 'TV-0024',
    proofUrl: 'https://imgur.com/tv-0024.png',
    reservedUntil: hoursFromNow(30),
  });

  await createTicketScenario({
    buyer: buyers[0],
    campaign: activeBusyCampaign,
    ticketNumber: 42,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'APT-0042',
    proofUrl: 'https://imgur.com/apt-0042.png',
    paidAt: daysAgo(3),
    approvedAt: daysAgo(3),
  });
  await createTicketScenario({
    buyer: buyers[3],
    campaign: activeBusyCampaign,
    ticketNumber: 256,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'APT-0256',
    proofUrl: 'https://imgur.com/apt-0256.png',
    paidAt: daysAgo(4),
    approvedAt: daysAgo(4),
  });
  await createTicketScenario({
    buyer: buyers[10],
    campaign: activeBusyCampaign,
    ticketNumber: 512,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'APT-0512',
    proofUrl: 'https://imgur.com/apt-0512.png',
    paidAt: daysAgo(2),
    approvedAt: daysAgo(2),
  });
  await createTicketScenario({
    buyer: buyers[2],
    campaign: activeBusyCampaign,
    ticketNumber: 100,
    ticketStatus: TicketStatus.RESERVED,
    reservedUntil: hoursFromNow(48),
  });
  await createTicketScenario({
    buyer: buyers[1],
    campaign: activeBusyCampaign,
    ticketNumber: 88,
    ticketStatus: TicketStatus.PAYMENT_PENDING,
    paymentStatus: PaymentStatus.PENDING,
    transactionId: 'APT-0088',
    proofUrl: 'https://imgur.com/apt-0088.png',
    reservedUntil: hoursFromNow(48),
  });
  await createTicketScenario({
    buyer: buyers[4],
    campaign: activeBusyCampaign,
    ticketNumber: 333,
    ticketStatus: TicketStatus.CANCELLED,
    paymentStatus: PaymentStatus.REJECTED,
    transactionId: 'APT-0333',
    proofUrl: 'https://imgur.com/apt-0333.png',
  });
  await createTicketScenario({
    buyer: buyers[5],
    campaign: activeBusyCampaign,
    ticketNumber: 144,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'APT-0144',
    proofUrl: 'https://imgur.com/apt-0144.png',
    paidAt: daysAgo(2),
    approvedAt: daysAgo(2),
  });
  await createTicketScenario({
    buyer: buyers[7],
    campaign: activeBusyCampaign,
    ticketNumber: 205,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'APT-0205',
    proofUrl: 'https://imgur.com/apt-0205.png',
    paidAt: daysAgo(1),
    approvedAt: daysAgo(1),
  });
  await createTicketScenario({
    buyer: buyers[8],
    campaign: activeBusyCampaign,
    ticketNumber: 275,
    ticketStatus: TicketStatus.RESERVED,
    reservedUntil: hoursFromNow(48),
  });
  await createTicketScenario({
    buyer: buyers[12],
    campaign: activeBusyCampaign,
    ticketNumber: 260,
    ticketStatus: TicketStatus.PAYMENT_PENDING,
    paymentStatus: PaymentStatus.PENDING,
    transactionId: 'APT-0260',
    proofUrl: 'https://imgur.com/apt-0260.png',
    reservedUntil: hoursFromNow(48),
  });

  await createTicketScenario({
    buyer: buyers[3],
    campaign: activePendingCampaign,
    ticketNumber: 15,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'CAR-0015',
    proofUrl: 'https://imgur.com/car-0015.png',
    paidAt: daysAgo(5),
    approvedAt: daysAgo(5),
  });
  await createTicketScenario({
    buyer: buyers[0],
    campaign: activePendingCampaign,
    ticketNumber: 97,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'CAR-0097',
    proofUrl: 'https://imgur.com/car-0097.png',
    paidAt: daysAgo(1),
    approvedAt: daysAgo(1),
  });
  await createTicketScenario({
    buyer: buyers[1],
    campaign: activePendingCampaign,
    ticketNumber: 44,
    ticketStatus: TicketStatus.PAYMENT_PENDING,
    paymentStatus: PaymentStatus.PENDING,
    transactionId: 'CAR-0044',
    proofUrl: 'https://imgur.com/car-0044.png',
    reservedUntil: hoursFromNow(24),
  });
  await createTicketScenario({
    buyer: buyers[2],
    campaign: activePendingCampaign,
    ticketNumber: 120,
    ticketStatus: TicketStatus.RESERVED,
    reservedUntil: hoursFromNow(24),
  });
  await createTicketScenario({
    buyer: buyers[10],
    campaign: activePendingCampaign,
    ticketNumber: 155,
    ticketStatus: TicketStatus.PAYMENT_PENDING,
    paymentStatus: PaymentStatus.PENDING,
    transactionId: 'CAR-0155',
    proofUrl: 'https://imgur.com/car-0155.png',
    reservedUntil: hoursFromNow(24),
  });
  await createTicketScenario({
    buyer: buyers[4],
    campaign: activePendingCampaign,
    ticketNumber: 188,
    ticketStatus: TicketStatus.PAID,
    paymentStatus: PaymentStatus.APPROVED,
    transactionId: 'CAR-0188',
    proofUrl: 'https://imgur.com/car-0188.png',
    paidAt: daysAgo(3),
    approvedAt: daysAgo(3),
  });

  console.log('Creating draw-ready locked campaign data...');
  const lockedTickets = await Promise.all([
    createTicketScenario({
      buyer: buyers[5],
      campaign: lockedDrawCampaign,
      ticketNumber: 12,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'IPH-0012',
      proofUrl: 'https://imgur.com/iph-0012.png',
      paidAt: daysAgo(6),
      approvedAt: daysAgo(6),
    }),
    createTicketScenario({
      buyer: buyers[6],
      campaign: lockedDrawCampaign,
      ticketNumber: 18,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'IPH-0018',
      proofUrl: 'https://imgur.com/iph-0018.png',
      paidAt: daysAgo(6),
      approvedAt: daysAgo(6),
    }),
    createTicketScenario({
      buyer: buyers[7],
      campaign: lockedDrawCampaign,
      ticketNumber: 27,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'IPH-0027',
      proofUrl: 'https://imgur.com/iph-0027.png',
      paidAt: daysAgo(5),
      approvedAt: daysAgo(5),
    }),
    createTicketScenario({
      buyer: buyers[8],
      campaign: lockedDrawCampaign,
      ticketNumber: 44,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'IPH-0044',
      proofUrl: 'https://imgur.com/iph-0044.png',
      paidAt: daysAgo(5),
      approvedAt: daysAgo(5),
    }),
    createTicketScenario({
      buyer: buyers[10],
      campaign: lockedDrawCampaign,
      ticketNumber: 58,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'IPH-0058',
      proofUrl: 'https://imgur.com/iph-0058.png',
      paidAt: daysAgo(4),
      approvedAt: daysAgo(4),
    }),
    createTicketScenario({
      buyer: buyers[3],
      campaign: lockedDrawCampaign,
      ticketNumber: 73,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'IPH-0073',
      proofUrl: 'https://imgur.com/iph-0073.png',
      paidAt: daysAgo(4),
      approvedAt: daysAgo(4),
    }),
  ]);

  console.log(`Locked campaign ready with ${lockedTickets.length} paid tickets`);

  console.log('Creating drawn campaign with winners...');
  const drawnTicketScenarios = await Promise.all([
    createTicketScenario({
      buyer: buyers[0],
      campaign: drawnCampaign,
      ticketNumber: 10,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0010',
      proofUrl: 'https://imgur.com/cash-0010.png',
      paidAt: daysAgo(12),
      approvedAt: daysAgo(12),
    }),
    createTicketScenario({
      buyer: buyers[7],
      campaign: drawnCampaign,
      ticketNumber: 20,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0020',
      proofUrl: 'https://imgur.com/cash-0020.png',
      paidAt: daysAgo(12),
      approvedAt: daysAgo(12),
    }),
    createTicketScenario({
      buyer: buyers[1],
      campaign: drawnCampaign,
      ticketNumber: 30,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0030',
      proofUrl: 'https://imgur.com/cash-0030.png',
      paidAt: daysAgo(11),
      approvedAt: daysAgo(11),
    }),
    createTicketScenario({
      buyer: buyers[3],
      campaign: drawnCampaign,
      ticketNumber: 40,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0040',
      proofUrl: 'https://imgur.com/cash-0040.png',
      paidAt: daysAgo(11),
      approvedAt: daysAgo(11),
    }),
    createTicketScenario({
      buyer: buyers[4],
      campaign: drawnCampaign,
      ticketNumber: 50,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0050',
      proofUrl: 'https://imgur.com/cash-0050.png',
      paidAt: daysAgo(10),
      approvedAt: daysAgo(10),
    }),
    createTicketScenario({
      buyer: buyers[5],
      campaign: drawnCampaign,
      ticketNumber: 60,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0060',
      proofUrl: 'https://imgur.com/cash-0060.png',
      paidAt: daysAgo(10),
      approvedAt: daysAgo(10),
    }),
    createTicketScenario({
      buyer: buyers[8],
      campaign: drawnCampaign,
      ticketNumber: 70,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0070',
      proofUrl: 'https://imgur.com/cash-0070.png',
      paidAt: daysAgo(9),
      approvedAt: daysAgo(9),
    }),
    createTicketScenario({
      buyer: buyers[9],
      campaign: drawnCampaign,
      ticketNumber: 80,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0080',
      proofUrl: 'https://imgur.com/cash-0080.png',
      paidAt: daysAgo(9),
      approvedAt: daysAgo(9),
    }),
    createTicketScenario({
      buyer: buyers[10],
      campaign: drawnCampaign,
      ticketNumber: 90,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0090',
      proofUrl: 'https://imgur.com/cash-0090.png',
      paidAt: daysAgo(8),
      approvedAt: daysAgo(8),
    }),
    createTicketScenario({
      buyer: buyers[6],
      campaign: drawnCampaign,
      ticketNumber: 100,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'CASH-0100',
      proofUrl: 'https://imgur.com/cash-0100.png',
      paidAt: daysAgo(8),
      approvedAt: daysAgo(8),
    }),
  ]);

  await markWinner(drawnCampaign.id, drawnTicketScenarios[1].ticket.id, 1);
  await markWinner(drawnCampaign.id, drawnTicketScenarios[6].ticket.id, 2);
  await markWinner(drawnCampaign.id, drawnTicketScenarios[9].ticket.id, 3);

  console.log('Creating completed campaign history...');
  const completedTicketScenarios = await Promise.all([
    createTicketScenario({
      buyer: buyers[0],
      campaign: completedCampaign,
      ticketNumber: 5,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'DUB-0005',
      proofUrl: 'https://imgur.com/dub-0005.png',
      paidAt: daysAgo(25),
      approvedAt: daysAgo(25),
    }),
    createTicketScenario({
      buyer: buyers[7],
      campaign: completedCampaign,
      ticketNumber: 12,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'DUB-0012',
      proofUrl: 'https://imgur.com/dub-0012.png',
      paidAt: daysAgo(24),
      approvedAt: daysAgo(24),
    }),
    createTicketScenario({
      buyer: buyers[8],
      campaign: completedCampaign,
      ticketNumber: 28,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'DUB-0028',
      proofUrl: 'https://imgur.com/dub-0028.png',
      paidAt: daysAgo(24),
      approvedAt: daysAgo(24),
    }),
    createTicketScenario({
      buyer: buyers[3],
      campaign: completedCampaign,
      ticketNumber: 36,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'DUB-0036',
      proofUrl: 'https://imgur.com/dub-0036.png',
      paidAt: daysAgo(23),
      approvedAt: daysAgo(23),
    }),
    createTicketScenario({
      buyer: buyers[10],
      campaign: completedCampaign,
      ticketNumber: 48,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'DUB-0048',
      proofUrl: 'https://imgur.com/dub-0048.png',
      paidAt: daysAgo(23),
      approvedAt: daysAgo(23),
    }),
    createTicketScenario({
      buyer: buyers[5],
      campaign: completedCampaign,
      ticketNumber: 72,
      ticketStatus: TicketStatus.PAID,
      paymentStatus: PaymentStatus.APPROVED,
      transactionId: 'DUB-0072',
      proofUrl: 'https://imgur.com/dub-0072.png',
      paidAt: daysAgo(22),
      approvedAt: daysAgo(22),
    }),
  ]);

  await markWinner(completedCampaign.id, completedTicketScenarios[1].ticket.id, 1);
  await markWinner(completedCampaign.id, completedTicketScenarios[4].ticket.id, 2);

  console.log('Creating audit logs...');
  await addAuditLogs(admins, campaigns);

  const userCount = await prisma.user.count();
  const campaignCount = await prisma.campaign.count();
  const ticketCount = await prisma.ticket.count();
  const paymentCount = await prisma.payment.count();
  const winnerCount = await prisma.winner.count();
  const pendingPaymentCount = await prisma.payment.count({
    where: { status: PaymentStatus.PENDING },
  });
  const activeCampaignCount = await prisma.campaign.count({
    where: { status: CampaignStatus.ACTIVE },
  });
  const lockedCampaignCount = await prisma.campaign.count({
    where: { status: CampaignStatus.LOCKED },
  });
  const publicWinnerCampaignCount = await prisma.campaign.count({
    where: {
      status: {
        in: [CampaignStatus.DRAWN, CampaignStatus.COMPLETED],
      },
    },
  });

  console.log('Seed completed successfully.');
  console.log('');
  console.log('Seed summary:');
  console.log(`- Users: ${userCount}`);
  console.log(`- Campaigns: ${campaignCount}`);
  console.log(`- Tickets: ${ticketCount}`);
  console.log(`- Payments: ${paymentCount}`);
  console.log(`- Winners: ${winnerCount}`);
  console.log(`- Active campaigns on home: ${activeCampaignCount}`);
  console.log(`- Locked campaigns ready for admin draw: ${lockedCampaignCount}`);
  console.log(`- Winner campaigns visible to public: ${publicWinnerCampaignCount}`);
  console.log(`- Pending payments for admin review: ${pendingPaymentCount}`);
  console.log('');
  console.log('Suggested demo accounts:');
  console.log('- Admin login: +251911000001 / 123456');
  console.log('- Creator login: +251922000001 / 123456');
  console.log('- Buyer with history: +251911000003 / 123456');
  console.log('- Buyer with pending items: +251911000004 / 123456');
  console.log('- Buyer with reserved tickets: +251911000005 / 123456');
  console.log('- Fresh buyer for new reservation: +251911000014 / 123456');
  console.log('');
  console.log('Suggested demo flows:');
  console.log(
    '- Buyer reservation flow: Samsung 65-inch 4K TV Giveaway, try free numbers like 12, 13, 14'
  );
  console.log(
    '- Admin pending payments flow: Brand New Toyota Land Cruiser and Luxury Apartment Raffle'
  );
  console.log(
    '- Admin run draw flow: iPhone 15 Pro Max Bundle is LOCKED and ready for draw'
  );
  console.log(
    '- Public winners flow: Cash Prize 100,000 ETB and Vacation Package to Dubai'
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
