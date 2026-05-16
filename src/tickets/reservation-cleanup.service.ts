import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';

const CLEANUP_INTERVAL_MS = 60_000;

@Injectable()
export class ReservationCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReservationCleanupService.name);
  private interval?: NodeJS.Timeout;

  constructor(private readonly tickets: TicketsService) {}

  onModuleInit() {
    this.interval = setInterval(() => {
      void this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    this.interval.unref?.();
  }

  onModuleDestroy() {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  private async cleanup() {
    try {
      const result = await this.tickets.cleanupExpiredReservations();

      if (result.expired > 0) {
        this.logger.log(`Released ${result.expired} expired reservations`);
      }
    } catch (error) {
      this.logger.error('Failed to release expired reservations', error);
    }
  }
}
