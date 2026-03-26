import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';

jest.mock('bcrypt');

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: jest.Mocked<Repository<User>>;
  let mockUser: User;

  beforeEach(async () => {
    mockUser = {
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
    };

    const mockUserRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    userRepository = module.get(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user with hashed password and default USER role', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.create(
        'John',
        'Doe',
        'john@example.com',
        'password123',
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('password123', 12);
      expect(userRepository.create).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
        role: Role.USER,
      });
      expect(userRepository.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });

    it('should create a user with specified role', async () => {
      const adminUser = { ...mockUser, role: Role.ADMIN };
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.create.mockReturnValue(adminUser);
      userRepository.save.mockResolvedValue(adminUser);

      const result = await service.create(
        'John',
        'Doe',
        'john@example.com',
        'password123',
        Role.ADMIN,
      );

      expect(userRepository.create).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
        role: Role.ADMIN,
      });
      expect(result.role).toBe(Role.ADMIN);
    });

    it('should normalize email to lowercase and trim names', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');
      userRepository.create.mockReturnValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.create(
        '  John  ',
        '  Doe  ',
        '  JOHN@EXAMPLE.COM  ',
        'password123',
      );

      expect(userRepository.create).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        passwordHash: 'hashed-password',
        role: Role.USER,
      });
    });
  });

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('john@example.com');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('unknown@example.com');

      expect(result).toBeNull();
    });

    it('should normalize email before searching', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await service.findByEmail('  JOHN@EXAMPLE.COM  ');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.findById('user-uuid-123');

      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid-123' },
      });
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.findById('unknown-uuid');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    it('should update firstName and lastName', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane', lastName: 'Smith' };
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-uuid-123', {
        firstName: 'Jane',
        lastName: 'Smith',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Jane', lastName: 'Smith' }),
      );
      expect(result).toEqual(updatedUser);
    });

    it('should update email when a new valid email is provided', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com' };
      userRepository.findOne.mockResolvedValue(mockUser); // findById only
      userRepository.save.mockResolvedValue(updatedUser);

      const result = await service.updateProfile('user-uuid-123', {
        email: 'new@example.com',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'new@example.com' }),
      );
      expect(result).toEqual(updatedUser);
    });

    it('should throw ConflictException when DB raises a unique constraint violation', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockRejectedValue({ code: '23505' }); // PostgreSQL unique violation

      await expect(
        service.updateProfile('user-uuid-123', { email: 'taken@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should rethrow unexpected DB errors as-is', async () => {
      const dbError = new Error('connection lost');
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockRejectedValue(dbError);

      await expect(
        service.updateProfile('user-uuid-123', { email: 'new@example.com' }),
      ).rejects.toThrow('connection lost');
    });

    it('should call save when email is the same as the current one', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      const result = await service.updateProfile('user-uuid-123', {
        email: 'john@example.com', // same as mockUser.email
      });

      expect(userRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockUser);
    });

    it('should return null when user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.updateProfile('unknown-uuid', {
        firstName: 'Jane',
      });

      expect(result).toBeNull();
      expect(userRepository.save).not.toHaveBeenCalled();
    });

    it('should handle partial updates (only firstName)', async () => {
      const updatedUser = { ...mockUser, firstName: 'Jane' };
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(updatedUser);

      await service.updateProfile('user-uuid-123', { firstName: 'Jane' });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          lastName: mockUser.lastName,
        }),
      );
    });

    it('should normalize email and trim names on update', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.save.mockResolvedValue(mockUser);

      await service.updateProfile('user-uuid-123', {
        firstName: '  Jane  ',
        email: '  NEW@EXAMPLE.COM  ',
      });

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Jane',
          email: 'new@example.com',
        }),
      );
    });

    describe('edge cases', () => {
      it('should call save when email is empty string', async () => {
        userRepository.findOne.mockResolvedValue(mockUser);
        userRepository.save.mockResolvedValue(mockUser);

        await service.updateProfile('user-uuid-123', { email: '' });

        expect(userRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should call save when email is whitespace-only string', async () => {
        userRepository.findOne.mockResolvedValue(mockUser);

        await service.updateProfile('user-uuid-123', { email: '   ' });

        expect(userRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should never call findByEmail — conflict is detected by the DB', async () => {
        const updatedUser = { ...mockUser, email: 'new@example.com' };
        userRepository.findOne.mockResolvedValue(mockUser);
        userRepository.save.mockResolvedValue(updatedUser);

        await service.updateProfile('user-uuid-123', {
          email: 'new@example.com',
        });

        // Only one findOne call: the initial findById
        expect(userRepository.findOne).toHaveBeenCalledTimes(1);
      });

      it('should call save when firstName is empty string', async () => {
        userRepository.findOne.mockResolvedValue(mockUser);

        await service.updateProfile('user-uuid-123', { firstName: '' });

        expect(userRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should call save when firstName is whitespace-only string', async () => {
        userRepository.findOne.mockResolvedValue(mockUser);

        await service.updateProfile('user-uuid-123', { firstName: '   ' });

        expect(userRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should call save when lastName is empty string', async () => {
        userRepository.findOne.mockResolvedValue(mockUser);

        await service.updateProfile('user-uuid-123', { lastName: '' });

        expect(userRepository.save).toHaveBeenCalledTimes(1);
      });

      it('should call save when body is empty (no fields provided)', async () => {
        userRepository.findOne.mockResolvedValue(mockUser);
        userRepository.save.mockResolvedValue(mockUser);

        const result = await service.updateProfile('user-uuid-123', {});

        expect(userRepository.save).toHaveBeenCalledTimes(1);
        expect(result).toEqual(mockUser);
      });

      it('should save when at least one valid field is provided alongside empty fields', async () => {
        const updatedUser = { ...mockUser, firstName: 'Jane' };
        userRepository.findOne.mockResolvedValue(mockUser);
        userRepository.save.mockResolvedValue(updatedUser);

        const result = await service.updateProfile('user-uuid-123', {
          firstName: 'Jane',
          email: '',
        });

        expect(userRepository.save).toHaveBeenCalledWith(
          expect.objectContaining({ firstName: 'Jane', email: mockUser.email }),
        );
        expect(result).toEqual(updatedUser);
      });
    });
  });

  describe('validatePassword', () => {
    it('should return true for correct password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validatePassword(
        mockUser,
        'correct-password',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        mockUser.passwordHash,
      );
      expect(result).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validatePassword(mockUser, 'wrong-password');

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'wrong-password',
        mockUser.passwordHash,
      );
      expect(result).toBe(false);
    });
  });
});
