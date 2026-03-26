import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import {
  User,
  toUserPublic,
  type UserPublic,
} from '../users/entities/user.entity';
import { ListUsersDto } from './dto/list-users.dto';
import { getPagination } from '../common/utils/pagination.utils';
import { ManageUserDto } from './dto/manage-user.dto';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mailService: MailService,
  ) {}

  async listUsers(query: ListUsersDto) {
    const { page, limit, skip } = getPagination(query);
    const where: Record<string, unknown> = {};

    if (query.search) {
      where.email = ILike(`%${query.search}%`);
    }
    if (query.role) {
      where.role = query.role;
    }
    if (typeof query.active === 'boolean') {
      where.active = query.active;
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

  async manageUser(id: string, dto: ManageUserDto) {
    const user = await this.getUserEntity(id);

    if (dto.role) {
      user.role = dto.role;
    }
    if (typeof dto.active === 'boolean') {
      user.active = dto.active;
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
}
