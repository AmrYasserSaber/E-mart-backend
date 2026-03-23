import { Test, TestingModule } from '@nestjs/testing';
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
