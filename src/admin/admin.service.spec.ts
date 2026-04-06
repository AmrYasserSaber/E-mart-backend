import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/enums/role.enum';
import { Order } from '../orders/entities/order.entity';
import { Seller, SellerStatus } from '../sellers/entities/seller.entity';
import { Payment } from '../payments/entities/payment.entity';

describe('AdminService', () => {
  let service: AdminService;

  const mockUserRepository: jest.Mocked<
    Pick<Repository<User>, 'findAndCount' | 'findOne' | 'save' | 'count'>
  > = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockSellerRepository: jest.Mocked<
    Pick<Repository<Seller>, 'findOne' | 'save' | 'findAndCount'>
  > = {
    findOne: jest.fn(),
    save: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockMailService: jest.Mocked<
    Pick<
      MailService,
      | 'sendAdminChangeNotice'
      | 'sendSellerApprovedNotice'
      | 'sendSellerRejectedNotice'
    >
  > = {
    sendAdminChangeNotice: jest.fn(),
    sendSellerApprovedNotice: jest.fn(),
    sendSellerRejectedNotice: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminService(
      mockUserRepository as Repository<User>,
      {} as Repository<Order>,
      mockSellerRepository as Repository<Seller>,
      {} as Repository<Payment>,
      mockMailService as MailService,
    );
  });

  it('lists users with pagination', async () => {
    mockUserRepository.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.listUsers({ page: 1, limit: 10 });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    expect(mockUserRepository.findAndCount).toHaveBeenCalled();
  });

  it('throws when user does not exist', async () => {
    mockUserRepository.findOne.mockResolvedValue(null);

    await expect(service.getUser('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('updates user role and active status', async () => {
    const existingUser = {
      id: '10dc3cd3-f3cc-476f-8dd8-0f94d3de0c42',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: Role.USER,
      active: true,
    } as User;

    mockUserRepository.findOne.mockResolvedValue(existingUser);
    mockUserRepository.count.mockResolvedValue(2);
    mockUserRepository.save = jest.fn().mockResolvedValue(existingUser);

    const result = await service.manageUser(existingUser.id, {
      role: Role.ADMIN,
      active: false,
    });

    expect(result.role).toBe(Role.ADMIN);
    expect(mockMailService.sendAdminChangeNotice).toHaveBeenCalledTimes(1);
  });

  it('approves seller and upgrades user role to seller', async () => {
    const seller = {
      id: 'seller-1',
      userId: 'user-1',
      storeName: 'Store',
      description: 'Desc',
      status: SellerStatus.PENDING,
      rating: 0,
      createdAt: new Date(),
    } as Seller;
    const user = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: Role.USER,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      authProvider: 'local',
      googleId: null,
      passwordHash: 'hash',
      emailVerifiedAt: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    } as User;

    mockSellerRepository.findOne.mockResolvedValue(seller);
    mockUserRepository.findOne.mockResolvedValue(user);
    mockSellerRepository.save.mockImplementation(async (v) => v as Seller);
    mockUserRepository.save.mockImplementation(async (v) => v as User);

    const result = await service.approveSellerStore('seller-1');

    expect(mockSellerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SellerStatus.APPROVED }),
    );
    expect(mockUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.SELLER }),
    );
    expect(mockMailService.sendSellerApprovedNotice).toHaveBeenCalledWith(
      'john@example.com',
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        storeName: 'Store',
      }),
    );
    expect(result.status).toBe(SellerStatus.APPROVED);
  });

  it('rejects seller and resets non-admin user role to user', async () => {
    const seller = {
      id: 'seller-2',
      userId: 'user-2',
      storeName: 'Store',
      description: 'Desc',
      status: SellerStatus.PENDING,
      rating: 0,
      createdAt: new Date(),
    } as Seller;
    const user = {
      id: 'user-2',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      role: Role.SELLER,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      authProvider: 'local',
      googleId: null,
      passwordHash: 'hash',
      emailVerifiedAt: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    } as User;

    mockSellerRepository.findOne.mockResolvedValue(seller);
    mockUserRepository.findOne.mockResolvedValue(user);
    mockSellerRepository.save.mockImplementation(async (v) => v as Seller);
    mockUserRepository.save.mockImplementation(async (v) => v as User);

    const result = await service.rejectSellerStore('seller-2');

    expect(mockSellerRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: SellerStatus.REJECTED }),
    );
    expect(mockUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.USER }),
    );
    expect(mockMailService.sendSellerRejectedNotice).toHaveBeenCalledWith(
      'john@example.com',
      expect.objectContaining({
        firstName: 'John',
        lastName: 'Doe',
        storeName: 'Store',
      }),
    );
    expect(result.status).toBe(SellerStatus.REJECTED);
  });

  it('rejects seller without changing admin user role', async () => {
    const seller = {
      id: 'seller-3',
      userId: 'admin-1',
      storeName: 'Store',
      description: 'Desc',
      status: SellerStatus.PENDING,
      rating: 0,
      createdAt: new Date(),
    } as Seller;
    const admin = {
      id: 'admin-1',
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      role: Role.ADMIN,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      authProvider: 'local',
      googleId: null,
      passwordHash: 'hash',
      emailVerifiedAt: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    } as User;

    mockSellerRepository.findOne.mockResolvedValue(seller);
    mockUserRepository.findOne.mockResolvedValue(admin);
    mockSellerRepository.save.mockImplementation(async (v) => v as Seller);
    mockUserRepository.save.mockImplementation(async (v) => v as User);

    await service.rejectSellerStore('seller-3');

    expect(mockUserRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.ADMIN }),
    );
  });
});
