import { Test, TestingModule } from '@nestjs/testing';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

describe('TicketsController', () => {
  let controller: TicketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsController],
      providers: [
        {
          provide: TicketsService,
          useValue: {
            getCampaignTicketSummary: jest.fn(),
            getTakenTickets: jest.fn(),
            reserveTicket: jest.fn(),
            findOne: jest.fn(),
            myTickets: jest.fn(),
            cleanupExpiredReservations: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<TicketsController>(TicketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
