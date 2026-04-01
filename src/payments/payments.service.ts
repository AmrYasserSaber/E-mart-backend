import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentStatus } from './entities/payment.entity';
import { UserCard } from './entities/user-card.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order.entity';
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
    @InjectRepository(UserCard)
    private readonly userCardRepository: Repository<UserCard>,
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
    userEmail: string,
  ): Promise<CreatePaymentResponse> {
    const paymentMethod = createDto.paymentMethod ?? 'KASHIER';
    if (!createDto.orderId) {
      throw new BadRequestException('orderId is required');
    }

    const order = await this.getUserOrderOrThrow(createDto.orderId, userId);
    const resolvedAmount = Number(order.total);

    if (order.status === OrderStatus.CONFIRMED) {
      throw new BadRequestException('Order is already paid');
    }

    const existingPayment = await this.paymentRepository.findOne({
      where: { orderId: createDto.orderId, status: PaymentStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    if (existingPayment) {
      return {
        message: 'Payment session already exists.',
        paymentUrl: existingPayment.redirectUrl,
      };
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
      customerEmail: userEmail,
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

    if (payment.status !== PaymentStatus.PENDING) {
      return payment;
    }

    payment.status = this.normalizeStatus(updateDto.status);
    if (updateDto.externalId) {
      payment.externalId = updateDto.externalId;
    }
    if (updateDto.rawResponse) {
      payment.rawResponse = updateDto.rawResponse;
    }

    const saved = await this.paymentRepository.save(payment);

    if (saved.status === PaymentStatus.SUCCESS && saved.orderId) {
      await this.orderRepository.update(
        { id: saved.orderId },
        {
          status: OrderStatus.CONFIRMED,
          paymentIntentId: saved.externalId ?? null,
        },
      );
    }

    return saved;
  }

  async updateStatusByExternalId(
    externalId: string,
    updateDto: UpdatePaymentStatusBody,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { externalId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.updateStatus(payment.id, updateDto);
  }

  async updateStatusByOrderId(
    orderId: string,
    updateDto: UpdatePaymentStatusBody,
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.updateStatus(payment.id, updateDto);
  }

  private normalizeStatus(value: string): PaymentStatus {
    const normalized = value?.toString().trim().toUpperCase();
    if (normalized === PaymentStatus.SUCCESS) return PaymentStatus.SUCCESS;
    if (normalized === PaymentStatus.FAILED) return PaymentStatus.FAILED;
    return PaymentStatus.PENDING;
  }

  async listCards(userId: string) {
    return this.userCardRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async saveCard(userId: string, cardData: any) {
    if (!cardData?.last4 || !cardData?.brand) {
      throw new BadRequestException('Card token data is incomplete');
    }

    const card = this.userCardRepository.create({
      userId,
      brand: cardData.brand,
      last4: cardData.last4,
      expMonth: cardData.expiryMonth,
      expYear: cardData.expiryYear,
      cardholderName: cardData.cardholderName,
      isDefault: false,
    });

    return this.userCardRepository.save(card);
  }

  async deleteCard(userId: string, cardId: string) {
    const card = await this.userCardRepository.findOne({
      where: { id: cardId, userId },
    });
    if (!card) {
      throw new NotFoundException('Card not found');
    }
    return this.userCardRepository.remove(card);
  }
}
