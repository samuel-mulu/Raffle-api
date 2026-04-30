import { IsOptional, IsString } from 'class-validator';

export class SubmitPaymentProofDto {
  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  proofUrl?: string;
}
