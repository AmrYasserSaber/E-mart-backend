import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
} from './schemas/admin.schemas';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/entities/order.entity';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
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
      user.role = dto.role;
    }
    if (activeChanged) {
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
      skip,
      take: limit,
    });

    return {
      data: orders.map((order) => ({
        id: order.id,
        userId: order.userId,
        items: order.items,
        total: Number(order.total),
        status: order.status,
        shippingAddress: order.shippingAddress,
        paymentIntentId: order.paymentIntentId,
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString(),
      })),
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
}
