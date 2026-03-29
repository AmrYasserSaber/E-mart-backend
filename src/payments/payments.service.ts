import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import {
  CreatePaymentBody,
  UpdatePaymentStatusBody,
} from './schemas/payments.schemas';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async create(userId: string, createDto: CreatePaymentBody) {
    const payment = this.paymentRepository.create({
      userId,
      amount: createDto.amount,
      currency: createDto.currency ?? 'EGP',
      orderId: createDto.orderId ?? null,
      status: PaymentStatus.PENDING,
      gateway: 'kashier',
    });

    return this.paymentRepository.save(payment);
  }

  async findOne(id: string, userId: string) {
    const payment = await this.paymentRepository.findOne({
      where: { id, userId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async findByOrderId(orderId: string, userId: string) {
    return this.paymentRepository.find({
      where: { orderId, userId },
    });
  }

  async updateStatus(
    id: string,
    updateDto: UpdatePaymentStatusBody,
    userId?: string,
  ) {
    // If userId is provided, ensure ownership. Webhooks might bypass userId.
    const whereClause: any = { id };
    if (userId) {
        whereClause.userId = userId;
    }

    const payment = await this.paymentRepository.findOne({ where: whereClause });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // A real implementation would verify the status transition here
    payment.status = updateDto.status as PaymentStatus;
    
    if (updateDto.externalId) {
      payment.externalId = updateDto.externalId;
    }
    if (updateDto.rawResponse) {
      payment.rawResponse = updateDto.rawResponse;
    }

    return this.paymentRepository.save(payment);
  }
}
