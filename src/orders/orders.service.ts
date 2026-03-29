import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order, OrderPublic, toOrderPublic } from './entities/order.entity';
import {
  OrderDetailsResponse,
  OrdersListResponse,
} from './schemas/order.schema';
import { Role } from '../common/enums/role.enum';
import { CartService } from '../cart/cart.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly cartService: CartService,
  ) {}

  private normalizeOrder(order: Order): OrderPublic {
    return toOrderPublic(order);
  }

  private sanitizeAddress(address: Order['shippingAddress']) {
    return {
      street: address.street.trim(),
      city: address.city.trim(),
      zip: address.zip.trim(),
      country: address.country.trim(),
    };
  }

  private toOrderDetails(order: Order): OrderDetailsResponse {
    return {
      id: order.id,
      items: order.items.map((item) => ({
        product: {
          id: item.productId,
          title: item.title,
        },
        qty: item.qty,
        price: item.price,
      })),
      total: Number(order.total),
      status: order.status,
      shippingAddress: order.shippingAddress,
      payment: {
        provider: 'stripe',
        status: order.paymentIntentId ? 'paid' : 'pending',
      },
      createdAt: order.createdAt.toISOString(),
    };
  }

  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderPublic> {
    const cartSummary = await this.cartService.getCartSummary(userId);
    const items = cartSummary.items;
    const total = cartSummary.total;

    const order = this.orderRepository.create({
      userId,
      items,
      total,
      shippingAddress: this.sanitizeAddress(createOrderDto.shippingAddress),
      paymentIntentId: null,
    });

    const saved = await this.orderRepository.save(order);
    await this.cartService.clearCart(userId);
    return this.normalizeOrder(saved);
  }

  async findAllForUser(
    userId: string,
    page: number,
    limit: number,
  ): Promise<OrdersListResponse> {
    const [orders, total] = await this.orderRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: orders.map((order) => ({
        id: order.id,
        total: Number(order.total),
        status: order.status,
        itemsCount: order.items.length,
        createdAt: order.createdAt.toISOString(),
      })),
      total,
      page,
    };
  }

  async findOneForUser(
    id: string,
    userId: string,
    role: Role,
  ): Promise<OrderDetailsResponse | null> {
    const where = role === Role.ADMIN ? { id } : { id, userId };
    const order = await this.orderRepository.findOne({ where });
    if (!order) return null;
    return this.toOrderDetails(order);
  }
}
