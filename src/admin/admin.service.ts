import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, MoreThanOrEqual, Repository } from 'typeorm';
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
import { Payment } from '../payments/entities/payment.entity';

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

    const user = await this.userRepository.findOne({
      where: { id: seller.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    seller.status = SellerStatus.APPROVED;
    user.role = Role.SELLER;

    const [saved] = await Promise.all([
      this.sellerRepository.save(seller),
      this.userRepository.save(user),
    ]);

    if (user.email) {
      try {
        await this.mailService.sendSellerApprovedNotice(user.email, {
          firstName: user.firstName ?? user.email,
          lastName: user.lastName ?? '',
          storeName: saved.storeName,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to send seller approved notice to ${user.email} (userId=${user.id})`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    return {
      id: saved.id,
      userId: saved.userId,
      status: saved.status,
      approvedAt: new Date().toISOString(),
    };
  }

  async rejectSellerStore(id: string) {
    const seller = await this.sellerRepository.findOne({ where: { id } });
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }

    const user = await this.userRepository.findOne({
      where: { id: seller.userId },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    seller.status = SellerStatus.REJECTED;
    if (user.role !== Role.ADMIN) {
      user.role = Role.USER;
    }

    const [saved] = await Promise.all([
      this.sellerRepository.save(seller),
      this.userRepository.save(user),
    ]);

    if (user.email) {
      try {
        await this.mailService.sendSellerRejectedNotice(user.email, {
          firstName: user.firstName ?? user.email,
          lastName: user.lastName ?? '',
          storeName: saved.storeName,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to send seller rejected notice to ${user.email} (userId=${user.id})`,
          err instanceof Error ? err.stack : err,
        );
      }
    }

    return {
      id: saved.id,
      userId: saved.userId,
      status: saved.status,
      rejectedAt: new Date().toISOString(),
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

  async getRevenueAnalytics(
    period: RevenueAnalyticsQuery['period'] = '12m',
  ): Promise<RevenueAnalyticsResponse> {
    const normalizedPeriod: '7d' | '12m' = period === '7d' ? '7d' : '12m';
    const now = new Date();
    const from = new Date(now);

    if (normalizedPeriod === '7d') {
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
    } else {
      from.setMonth(from.getMonth() - 11, 1);
      from.setHours(0, 0, 0, 0);
    }

    const orders = await this.orderRepository.find({
      where: { createdAt: MoreThanOrEqual(from) },
      select: {
        id: true,
        total: true,
        status: true,
        createdAt: true,
      },
      order: { createdAt: 'ASC' },
    });

    const buckets = new Map<string, { label: string; revenue: number }>();

    if (normalizedPeriod === '7d') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-US', {
          weekday: 'short',
        });
        buckets.set(key, { label, revenue: 0 });
      }

      for (const order of orders) {
        if (order.status === OrderStatus.CANCELLED) continue;
        const key = order.createdAt.toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.revenue += Number(order.total);
        }
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('en-US', {
          month: 'short',
        });
        buckets.set(key, { label, revenue: 0 });
      }

      for (const order of orders) {
        if (order.status === OrderStatus.CANCELLED) continue;
        const d = order.createdAt;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.revenue += Number(order.total);
        }
      }
    }

    const data = Array.from(buckets.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      revenue: Number(value.revenue.toFixed(2)),
    }));

    const totalRevenue = Number(
      data.reduce((sum, point) => sum + point.revenue, 0).toFixed(2),
    );

    return {
      period: normalizedPeriod,
      currency: 'EGP',
      totalRevenue,
      data,
    };
  }
}
