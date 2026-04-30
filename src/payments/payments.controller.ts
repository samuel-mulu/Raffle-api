import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @UseGuards(JwtAuthGuard)
  @Post('payments/:ticketId/submit-proof')
  submitProof(
    @CurrentUser() user: any,
    @Param('ticketId') ticketId: string,
    @Body() dto: SubmitPaymentProofDto,
  ) {
    return this.payments.submitProof(user.sub, ticketId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/payments/pending')
  pendingPayments() {
    return this.payments.pendingPayments();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/payments/:paymentId/approve')
  approvePayment(
    @CurrentUser() user: any,
    @Param('paymentId') paymentId: string,
  ) {
    return this.payments.approvePayment(user.sub, paymentId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/payments/:paymentId/reject')
  rejectPayment(
    @CurrentUser() user: any,
    @Param('paymentId') paymentId: string,
  ) {
    return this.payments.rejectPayment(user.sub, paymentId);
  }
}
