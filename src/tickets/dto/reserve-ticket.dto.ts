import { IsInt, Min } from 'class-validator';

export class ReserveTicketDto {
  @IsInt()
  @Min(1)
  ticketNumber: number;
}
