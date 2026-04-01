import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  User,
  toUserPublic,
  type UserPublic,
} from '../users/entities/user.entity';
import { getPagination } from '../common/utils/pagination.utils';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/enums/role.enum';
import {
  type ListUsersQuery,
  type ManageUserBody,
  type ListAdminOrdersQuery,
  type ManageOrderStatusBody,
  type ListPendingSellersQuery,
  type RevenueAnalyticsQuery,
  type RevenueAnalyticsResponse,
} from './schemas/admin.schemas';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order.entity';
import { Seller, SellerStatus } from '../sellers/entities/seller.entity';
import { Address } from '../addresses/entities/address.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Seller)
    private readonly sellerRepository: Repository<Seller>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly mailService: MailService,
  ) {}

  async getRevenueAnalytics(
    query: RevenueAnalyticsQuery,
  ): Promise<RevenueAnalyticsResponse> {
    const period = query.period ?? '12m';
    const now = new Date();
    const nowUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      ),
    );

    const points: Array<{ key: string; label: string; revenue: number }> = [];
    const labelFormatter = new Intl.DateTimeFormat(
      'en-US',
      period === '7d'
        ? { month: 'short', day: 'numeric', timeZone: 'UTC' }
        : { month: 'short', timeZone: 'UTC' },
    );

    if (period === '7d') {
      for (let offset = 6; offset >= 0; offset -= 1) {
        const d = new Date(
          Date.UTC(
            nowUtc.getUTCFullYear(),
            nowUtc.getUTCMonth(),
            nowUtc.getUTCDate() - offset,
          ),
        );
        const key = d.toISOString().slice(0, 10);
        points.push({ key, label: labelFormatter.format(d), revenue: 0 });
      }
    } else {
      for (let offset = 11; offset >= 0; offset -= 1) {
        const d = new Date(
          Date.UTC(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() - offset, 1),
        );
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        points.push({ key, label: labelFormatter.format(d), revenue: 0 });
      }
    }

    const startKey = points[0]?.key;
    if (!startKey) {
      return {
        period,
        currency: 'EGP',
        totalRevenue: 0,
        data: [],
      };
    }

    const startDate =
      period === '7d'
        ? new Date(`${startKey}T00:00:00.000Z`)
        : new Date(`${startKey}-01T00:00:00.000Z`);

    const successfulPayments = await this.paymentRepository.find({
      where: {
        status: PaymentStatus.SUCCESS,
      },
      select: {
        amount: true,
        currency: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
    });

    const pointByKey = new Map(points.map((point) => [point.key, point]));
    let totalRevenue = 0;
    let primaryCurrency = 'EGP';

    for (const payment of successfulPayments) {
      if (payment.createdAt < startDate || payment.createdAt > nowUtc) {
        continue;
      }

      const createdAt = payment.createdAt;
      const key =
        period === '7d'
          ? createdAt.toISOString().slice(0, 10)
          : `${createdAt.getUTCFullYear()}-${String(createdAt.getUTCMonth() + 1).padStart(2, '0')}`;

      const point = pointByKey.get(key);
      if (!point) continue;

      const amount = Number(payment.amount) || 0;
      point.revenue += amount;
      totalRevenue += amount;

      if (payment.currency?.trim()) {
        primaryCurrency = payment.currency.toUpperCase();
      }
    }

    const normalizedData = points.map((point) => ({
      ...point,
      revenue: Number(point.revenue.toFixed(2)),
    }));

    return {
      period,
      currency: primaryCurrency,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      data: normalizedData,
    };
  }

  async listUsers(query: ListUsersQuery) {
    const { page, limit, skip } = getPagination(query);
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.email = ILike(`%${query.search}%`);
    }
    if (query.role) {
      where.role = query.role;
    }
    if (query.active === true || query.active === 'true') {
      where.active = true;
    } else if (query.active === false || query.active === 'false') {
      where.active = false;
    }

    const [items, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const sanitizedItems: UserPublic[] = items.map(toUserPublic);

    return {
      items: sanitizedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getUser(id: string) {
    const user = await this.getUserEntity(id);
    return toUserPublic(user);
  }

  async manageUser(id: string, dto: ManageUserBody) {
    const user = await this.getUserEntity(id);

    const roleChanged = dto.role !== undefined && dto.role !== user.role;
    const activeChanged =
      dto.active !== undefined && typeof dto.active === 'boolean'
        ? dto.active !== user.active
        : false;

    if (!roleChanged && !activeChanged) {
      return toUserPublic(user);
    }

    if (roleChanged && dto.role !== undefined) {
      if (user.role === Role.ADMIN && dto.role !== Role.ADMIN) {
        const adminCount = await this.userRepository.count({
          where: { role: Role.ADMIN, active: true },
        });
        if (adminCount <= 1) {
          throw new BadRequestException(
            'Cannot change the role of the last active admin.',
          );
        }
      }
      user.role = dto.role;
    }
    if (activeChanged) {
      if (user.role === Role.ADMIN && dto.active === false) {
        const activeAdminCount = await this.userRepository.count({
          where: { role: Role.ADMIN, active: true },
        });
        if (activeAdminCount <= 1) {
          throw new BadRequestException(
            'Cannot deactivate the last active admin.',
          );
        }
      }
      user.active = dto.active as boolean;
    }

    const saved = await this.userRepository.save(user);

    if (saved.email) {
      try {
        await this.mailService.sendAdminChangeNotice(saved.email, {
          firstName: saved.firstName ?? saved.email,
          lastName: saved.lastName ?? '',
          role: saved.role ?? Role.USER,
          active: saved.active,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to send admin change notice to ${saved.email} (userId=${saved.id})`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    return toUserPublic(saved);
  }

  async verifyUser(id: string) {
    const user = await this.getUserEntity(id);
    if (user.emailVerifiedAt) {
      return toUserPublic(user);
    }
    user.emailVerifiedAt = new Date();
    const saved = await this.userRepository.save(user);
    return toUserPublic(saved);
  }

  private async getUserEntity(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  async listOrders(query: ListAdminOrdersQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const where: { userId?: string; status?: OrderStatus } = {};
    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.status) {
      where.status = query.status;
    }

    const [orders, total] = await this.orderRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      relations: ['shippingAddress'],
      skip,
      take: limit,
    });

    return {
      data: orders.map((order) => {
        const shippingAddress: Address | null = order.shippingAddress;

        const serializedShippingAddress = shippingAddress
          ? {
              id: shippingAddress.id,
              label: shippingAddress.label,
              firstName: shippingAddress.firstName,
              lastName: shippingAddress.lastName,
              phone: shippingAddress.phone,
              street: shippingAddress.street,
              city: shippingAddress.city,
              isPrimary: shippingAddress.isPrimary,
              createdAt:
                shippingAddress.createdAt instanceof Date
                  ? shippingAddress.createdAt.toISOString()
                  : String(shippingAddress.createdAt),
              updatedAt:
                shippingAddress.updatedAt instanceof Date
                  ? shippingAddress.updatedAt.toISOString()
                  : String(shippingAddress.updatedAt),
            }
          : null;

        return {
          id: order.id,
          userId: order.userId,
          items: order.items,
          total: Number(order.total),
          status: order.status,
          shippingAddress: serializedShippingAddress,
          paymentMethod: order.paymentMethod,
          shippingAddressId: serializedShippingAddress?.id ?? null,
          paymentIntentId: order.paymentIntentId,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateOrderStatus(id: string, dto: ManageOrderStatusBody) {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    order.status = dto.status;
    const saved = await this.orderRepository.save(order);

    return {
      id: saved.id,
      status: saved.status,
      updatedAt: saved.updatedAt.toISOString(),
    };
  }

  async approveSellerStore(id: string) {
    const seller = await this.sellerRepository.findOne({ where: { id } });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    seller.status = SellerStatus.APPROVED;
    const saved = await this.sellerRepository.save(seller);

    return {
      id: saved.id,
      userId: saved.userId,
      status: saved.status,
      approvedAt: new Date().toISOString(),
    };
  }

  async listPendingSellers(query: ListPendingSellersQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const [sellers, total] = await this.sellerRepository.findAndCount({
      where: { status: SellerStatus.PENDING },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: sellers.map((seller) => ({
        id: seller.id,
        userId: seller.userId,
        storeName: seller.storeName,
        description: seller.description,
        status: seller.status,
        rating: seller.rating,
        createdAt: seller.createdAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
