import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { User, UserPublic } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { AuthProvider } from 'src/common/enums/auth-provider.enum';

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
    active: true,
    updatedAt: new Date('2024-01-01'),
    emailVerifiedAt: null,
    emailVerificationCodeHash: null,
    emailVerificationExpiresAt: null,
    authProvider: AuthProvider.LOCAL,
    googleId: null,
  };

  const mockCurrentUser: UserPublic = {
    id: 'user-uuid-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: Role.USER,
    active: true,
    emailVerifiedAt: null,
    createdAt: new Date('2024-01-01').toISOString(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findById: jest.fn(),
      updateProfile: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
      ],
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
        active: mockUser.active,
        emailVerifiedAt: null,
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

  describe('updateProfile', () => {
    it('should update and return the current user public data', async () => {
      const updatedUser: User = {
        ...mockUser,
        firstName: 'Jane',
        lastName: 'Smith',
      };
      usersService.updateProfile.mockResolvedValue(updatedUser);

      const result = await controller.updateProfile(
        { firstName: 'Jane', lastName: 'Smith' },
        mockCurrentUser,
      );

      expect(usersService.updateProfile).toHaveBeenCalledWith('user-uuid-123', {
        firstName: 'Jane',
        lastName: 'Smith',
      });
      expect(result).toEqual({
        id: updatedUser.id,
        firstName: 'Jane',
        lastName: 'Smith',
        email: updatedUser.email,
        role: updatedUser.role,
        active: updatedUser.active,
        emailVerifiedAt: null,
        createdAt: updatedUser.createdAt.toISOString(),
      });
    });

    it('should throw NotFoundException when current user no longer exists', async () => {
      usersService.updateProfile.mockResolvedValue(null);

      await expect(
        controller.updateProfile({ firstName: 'Jane' }, mockCurrentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateUser (admin)', () => {
    it('should throw NotFoundException when target user does not exist', async () => {
      usersService.updateProfile.mockResolvedValue(null);

      await expect(
        controller.updateUser({ firstName: 'Jane' }, 'unknown-uuid'),
      ).rejects.toThrow(NotFoundException);

      expect(usersService.updateProfile).toHaveBeenCalledWith('unknown-uuid', {
        firstName: 'Jane',
      });
    });
  });
});
