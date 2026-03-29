import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { Order } from '../orders/entities/order.entity';
import { KashierProvider } from './providers/kashier.provider';
import {
  CreatePaymentBody,
  CreatePaymentResponse,
  UpdatePaymentStatusBody,
} from './schemas/payments.schemas';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly kashierProvider: KashierProvider,
  ) {}

  private async getUserOrderOrThrow(orderId: string, userId: string) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, userId },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  async create(
    userId: string,
    createDto: CreatePaymentBody,
  ): Promise<CreatePaymentResponse> {
    const paymentMethod = createDto.paymentMethod ?? 'KASHIER';
    if (!createDto.orderId) {
      throw new BadRequestException('orderId is required');
    }

    const order = await this.getUserOrderOrThrow(createDto.orderId, userId);
    const orderAmount = Number(order.total);
    const resolvedAmount =
      createDto.amount !== undefined ? Number(createDto.amount) : orderAmount;

    if (resolvedAmount !== orderAmount) {
      throw new BadRequestException(
        'Payment amount does not match order total',
      );
    }

    const currency = createDto.currency ?? 'EGP';

    if (paymentMethod === 'CASH_ON_DELIVERY') {
      const payment = this.paymentRepository.create({
        userId,
        amount: resolvedAmount,
        currency,
        orderId: createDto.orderId,
        status: PaymentStatus.PENDING,
        gateway: 'cash_on_delivery',
        externalId: null,
        redirectUrl: null,
        rawResponse: { method: 'CASH_ON_DELIVERY' },
      });

      await this.paymentRepository.save(payment);
      return {
        message: 'Payment process initialized successfully (cash on delivery).',
        paymentUrl: null,
      };
    }

    const kashier = await this.kashierProvider.createPaymentLink({
      orderId: createDto.orderId,
      amount: resolvedAmount,
      currency,
    });

    const payment = this.paymentRepository.create({
      userId,
      amount: resolvedAmount,
      currency,
      orderId: createDto.orderId,
      status: PaymentStatus.PENDING,
      gateway: 'kashier',
      externalId: kashier.externalId ?? null,
      redirectUrl: kashier.redirectUrl,
      rawResponse: kashier.raw,
    });

    await this.paymentRepository.save(payment);

    return {
      message: 'Payment process initialized successfully.',
      paymentUrl: kashier.redirectUrl,
    };
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

    const payment = await this.paymentRepository.findOne({
      where: whereClause,
    });

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
