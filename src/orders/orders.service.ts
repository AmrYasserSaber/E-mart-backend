import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateOrderDto } from './dto/create-order.dto';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';
import {
  Order,
  OrderProductItem,
  OrderPublic,
  OrderStatus,
  toOrderPublic,
} from './entities/order.entity';
import {
  OrderDetailsResponse,
  OrdersListResponse,
  UpdateOrderStatusBody,
  UpdateOrderStatusResponse,
} from './schemas/order.schema';
import { Role } from '../common/enums/role.enum';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { Product } from '../products/entities/product.entity';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly cartService: CartService,
    private readonly addressesService: AddressesService,
  ) {}

  private normalizeOrder(order: Order): OrderPublic {
    return toOrderPublic(order);
  }

   private async toOrderDetails(order: Order): Promise<OrderDetailsResponse> {
    const latestPayment = await this.paymentRepository.findOne({
      where: { orderId: order.id },
      order: { createdAt: 'DESC' },
    });

    const provider: 'kashier' | 'cash_on_delivery' =
      latestPayment?.gateway === 'cash_on_delivery' ||
      order.paymentMethod === 'CASH_ON_DELIVERY'
        ? 'cash_on_delivery'
        : 'kashier';

    const paymentStatus = latestPayment
      ? latestPayment.status === PaymentStatus.SUCCESS
        ? 'paid'
        : latestPayment.status === PaymentStatus.FAILED
          ? 'failed'
          : 'pending'
      : order.paymentIntentId
        ? 'paid'
        : 'pending';

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
      shippingAddressId: order.shippingAddressId,
      shippingAddress: order.shippingAddress
        ? {
            id: order.shippingAddress.id,
            label: order.shippingAddress.label,
            firstName: order.shippingAddress.firstName,
            lastName: order.shippingAddress.lastName,
            phone: order.shippingAddress.phone,
            street: order.shippingAddress.street,
            city: order.shippingAddress.city,
            isPrimary: order.shippingAddress.isPrimary,
            createdAt: order.shippingAddress.createdAt.toISOString(),
            updatedAt: order.shippingAddress.updatedAt.toISOString(),
          }
        : null,
      payment: {
        method: order.paymentMethod,
        provider,
        status: paymentStatus,
      },
      createdAt: order.createdAt.toISOString(),
    };
  }


  private async getSellerProductIds(sellerUserId: string): Promise<string[]> {
    const rows = await this.productRepository.find({
      where: { sellerId: sellerUserId },
      select: { id: true },
    });

    return rows.map((product) => product.id);
  }

  private sellerItemsOnly(
    order: Order,
    sellerUserId: string,
    sellerProductIds: Set<string>,
  ): OrderProductItem[] {
    return order.items.filter(
      (item) =>
        item.sellerId === sellerUserId || sellerProductIds.has(item.productId),
    );
  }

  async create(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<OrderPublic> {
    await this.addressesService.assertAddressExistsForUser(
      userId,
      createOrderDto.addressId,
    );
    const cartSummary = await this.cartService.getCartSummary(userId);
    const items = cartSummary.items;
    const total = cartSummary.total;
    const order = this.orderRepository.create({
      userId,
      items,
      total,
      paymentMethod: createOrderDto.paymentMethod,
      shippingAddressId: createOrderDto.addressId,
      paymentIntentId: null,
    });

    const saved = await this.orderRepository.save(order);
    const hydrated = await this.orderRepository.findOne({
      where: { id: saved.id },
      relations: ['shippingAddress'],
    });
    await this.cartService.clearCart(userId);
    return this.normalizeOrder(hydrated ?? saved);
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
    const order = await this.orderRepository.findOne({
      where,
      relations: ['shippingAddress'],
    });
    if (!order) return null;
    return this.toOrderDetails(order);
  }

  async findAllForSeller(
    sellerUserId: string,
    page: number,
    limit: number,
  ): Promise<OrdersListResponse> {
    const sellerProductIds = await this.getSellerProductIds(sellerUserId);

    const qb = this.orderRepository.createQueryBuilder('o');

    if (sellerProductIds.length > 0) {
      qb.where(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(o.items) AS item
          WHERE item->>'sellerId' = :sellerUserId OR item->>'productId' IN (:...productIds)
        )`,
        {
          sellerUserId,
          productIds: sellerProductIds,
        },
      );
    } else {
      qb.where(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(o.items) AS item
          WHERE item->>'sellerId' = :sellerUserId
        )`,
        { sellerUserId },
      );
    }

    qb.orderBy('o.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [orders, total] = await qb.getManyAndCount();
    const sellerProductIdsSet = new Set(sellerProductIds);

    return {
      data: orders.map((order) => {
        const sellerItems = this.sellerItemsOnly(
          order,
          sellerUserId,
          sellerProductIdsSet,
        );

        return {
          id: order.id,
          total: Number(order.total),
          status: order.status,
          itemsCount: sellerItems.length,
          createdAt: order.createdAt.toISOString(),
        };
      }),
      total,
      page,
    };
  }

  async findOneForSeller(
    id: string,
    sellerUserId: string,
  ): Promise<OrderDetailsResponse | null> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) return null;

    const sellerProductIds = new Set(
      await this.getSellerProductIds(sellerUserId),
    );
    const sellerItems = this.sellerItemsOnly(
      order,
      sellerUserId,
      sellerProductIds,
    );

    if (!sellerItems.length) {
      return null;
    }

    return this.toOrderDetails(order);
  }

  async updateStatusForSeller(
    id: string,
    sellerUserId: string,
    dto: UpdateOrderStatusBody,
  ): Promise<UpdateOrderStatusResponse> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const sellerProductIds = new Set(
      await this.getSellerProductIds(sellerUserId),
    );
    const sellerItems = this.sellerItemsOnly(
      order,
      sellerUserId,
      sellerProductIds,
    );

    if (!sellerItems.length) {
      throw new NotFoundException('Order not found');
    }

    const allowedStatuses = new Set<OrderStatus>([
      OrderStatus.CONFIRMED,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
    ]);

    if (!allowedStatuses.has(dto.status)) {
      throw new BadRequestException(
        'Seller can set status only to confirmed, shipped, or delivered',
      );
    }

    order.status = dto.status;
    const saved = await this.orderRepository.save(order);

    return {
      id: saved.id,
      status: saved.status,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }
}
