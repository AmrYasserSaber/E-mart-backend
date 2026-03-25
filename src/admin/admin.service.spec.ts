import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { AdminService } from './admin.service';
import { User } from '../users/entities/user.entity';
import { MailService } from '../mail/mail.service';
import { Role } from '../common/enums/role.enum';

describe('AdminService', () => {
  const mockRepository: jest.Mocked<
    Pick<Repository<User>, 'findAndCount' | 'findOne' | 'save'>
  > = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
  };

  const mockMailService: jest.Mocked<
    Pick<MailService, 'sendAdminChangeNotice'>
  > = {
    sendAdminChangeNotice: jest.fn(),
  };

  const service = new AdminService(
    mockRepository as Repository<User>,
    mockMailService as MailService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists users with pagination', async () => {
    mockRepository.findAndCount.mockResolvedValue([[], 0]);

    const result = await service.listUsers({ page: 1, limit: 10 });

    expect(result).toEqual({
      items: [],
      total: 0,
      page: 1,
      limit: 10,
      totalPages: 0,
    });
    expect(mockRepository.findAndCount).toHaveBeenCalled();
  });

  it('throws when user does not exist', async () => {
    mockRepository.findOne.mockResolvedValue(null);

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
    };

    mockRepository.findOne.mockResolvedValue(existingUser);
    mockRepository.save = jest.fn().mockResolvedValue(existingUser);

    const result = await service.manageUser(existingUser.id, {
      role: Role.ADMIN,
      active: false,
    });

    expect(result.role).toBe(Role.ADMIN);
    expect(result.active).toBe(false);
    expect(mockMailService.sendAdminChangeNotice).toHaveBeenCalledTimes(1);
  });
});
