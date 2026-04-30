import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SubmitPaymentProofDto } from './dto/submit-payment-proof.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {}

  async submitProof(userId: string, ticketId: string, dto: SubmitPaymentProofDto) {
    const payment = await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.ticket.findUnique({
        where: { id: ticketId },
        include: { campaign: true },
      });

      if (!ticket) throw new NotFoundException('Ticket not found');

      if (ticket.userId !== userId) {
        throw new ForbiddenException('This ticket does not belong to you');
      }

      if (ticket.status !== TicketStatus.RESERVED) {
        throw new BadRequestException('Ticket is not reserved');
      }

      if (ticket.reservedUntil && ticket.reservedUntil < new Date()) {
        throw new BadRequestException('Reservation expired');
      }

      const newPayment = await tx.payment.create({
        data: {
          campaignId: ticket.campaignId,
          ticketId: ticket.id,
          userId,
          amount: ticket.campaign.ticketPrice,
          transactionId: dto.transactionId,
          proofUrl: dto.proofUrl,
          status: PaymentStatus.PENDING,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          status: TicketStatus.PAYMENT_PENDING,
        },
      });

      return newPayment;
    });

    await this.audit.log(
      userId,
      'PAYMENT_SUBMITTED',
      'Payment',
      payment.id,
      { ticketId }
    );

    return payment;
  }

  pendingPayments() {
    return this.prisma.payment.findMany({
      where: { status: PaymentStatus.PENDING },
      include: {
        user: true,
        ticket: true,
        campaign: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approvePayment(adminId: string, paymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
        include: { ticket: true },
      });

      if (!payment) throw new NotFoundException('Payment not found');

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment already processed');
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.APPROVED,
          approvedAt: new Date(),
        },
      });

      await tx.ticket.update({
        where: { id: payment.ticketId },
        data: {
          status: TicketStatus.PAID,
          paidAt: new Date(),
        },
      });

      return payment;
    });

    await this.audit.log(
      adminId,
      'PAYMENT_APPROVED',
      'Payment',
      result.id,
      { ticketId: result.ticketId }
    );

    return { success: true };
  }

  async rejectPayment(adminId: string, paymentId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (!payment) throw new NotFoundException('Payment not found');

      if (payment.status !== PaymentStatus.PENDING) {
        throw new BadRequestException('Payment already processed');
      }

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.REJECTED,
        },
      });

      await tx.ticket.update({
        where: { id: payment.ticketId },
        data: {
          status: TicketStatus.CANCELLED,
        },
      });

      return payment;
    });

    await this.audit.log(
      adminId,
      'PAYMENT_REJECTED',
      'Payment',
      result.id,
      { ticketId: result.ticketId }
    );

    return { success: true };
  }
}
