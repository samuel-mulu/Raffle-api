import { Module } from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { TicketsController } from './tickets.controller';
import { ReservationCleanupService } from './reservation-cleanup.service';

@Module({
  providers: [TicketsService, ReservationCleanupService],
  controllers: [TicketsController],
})
export class TicketsModule {}
