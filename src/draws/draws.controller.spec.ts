import { Test, TestingModule } from '@nestjs/testing';
import { DrawsController } from './draws.controller';
import { DrawsService } from './draws.service';

describe('DrawsController', () => {
  let controller: DrawsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DrawsController],
      providers: [
        {
          provide: DrawsService,
          useValue: {
            getWinners: jest.fn(),
            runDraw: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<DrawsController>(DrawsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
