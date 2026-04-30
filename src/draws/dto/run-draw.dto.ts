import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class RunDrawDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  winnerCount?: number = 3;
}
