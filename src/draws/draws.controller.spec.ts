import { Test, TestingModule } from '@nestjs/testing';
import { DrawsController } from './draws.controller';

describe('DrawsController', () => {
  let controller: DrawsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DrawsController],
    }).compile();

    controller = module.get<DrawsController>(DrawsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
