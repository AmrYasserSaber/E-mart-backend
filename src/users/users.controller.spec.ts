import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: jest.Mocked<UsersService>;

  const mockUser: User = {
    id: 'user-uuid-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    passwordHash: 'hashed-password',
    role: Role.USER,
    createdAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get(UsersService);
  });

  describe('findOne', () => {
    it('should return user public data when user exists', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await controller.findOne('user-uuid-123');

      expect(usersService.findById).toHaveBeenCalledWith('user-uuid-123');
      expect(result).toEqual({
        id: mockUser.id,
        firstName: mockUser.firstName,
        lastName: mockUser.lastName,
        email: mockUser.email,
        role: mockUser.role,
        createdAt: mockUser.createdAt.toISOString(),
      });
    });

    it('should throw NotFoundException when user does not exist', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(controller.findOne('unknown-uuid')).rejects.toThrow(
        NotFoundException,
      );

      expect(usersService.findById).toHaveBeenCalledWith('unknown-uuid');
    });
  });
});
