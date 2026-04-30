import { Module } from '@nestjs/common';
import { DrawsService } from './draws.service';
import { DrawsController } from './draws.controller';

@Module({
  providers: [DrawsService],
  controllers: [DrawsController]
})
export class DrawsModule {}
