import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let dataSource: jest.Mocked<DataSource>;

  const mockUser: User = {
    id: 'user-uuid-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    passwordHash: 'hashed-password',
    role: Role.USER,
    createdAt: new Date('2024-01-01'),
  };

  const mockRefreshToken: RefreshToken = {
    id: 'token-uuid-123',
    userId: mockUser.id,
    user: mockUser,
    tokenHash: 'hashed-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      validatePassword: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-access-token'),
    };

    const mockRefreshTokenRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    dataSource = module.get(DataSource);
  });

  describe('register', () => {
    it('should register a new user and return tokens', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await authService.register(
        'John',
        'Doe',
        'john@example.com',
        'password123',
      );

      expect(usersService.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(usersService.create).toHaveBeenCalledWith(
        'John',
        'Doe',
        'john@example.com',
        'password123',
      );
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
      expect(result).toHaveProperty('access_token', 'mock-access-token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register('John', 'Doe', 'john@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(true);
      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await authService.login('john@example.com', 'password123');

      expect(usersService.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockUser,
        'password123',
      );
      expect(result).toHaveProperty('access_token', 'mock-access-token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe(mockUser.email);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login('unknown@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(false);

      await expect(
        authService.login('john@example.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const mockRefreshTokenRepo = {
        findOne: jest.fn().mockResolvedValue(mockRefreshToken),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn().mockReturnValue(mockRefreshToken),
        save: jest.fn().mockResolvedValue(mockRefreshToken),
      };

      dataSource.transaction.mockImplementation(async (callback: any) => {
        return callback({
          getRepository: () => mockRefreshTokenRepo,
        });
      });

      const result = await authService.refresh('valid-refresh-token');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const mockRefreshTokenRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.transaction.mockImplementation(async (callback: any) => {
        return callback({
          getRepository: () => mockRefreshTokenRepo,
        });
      });

      await expect(authService.refresh('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const expiredToken = {
        ...mockRefreshToken,
        expiresAt: new Date(Date.now() - 1000),
      };

      const mockRefreshTokenRepo = {
        findOne: jest.fn().mockResolvedValue(expiredToken),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction.mockImplementation(async (callback: any) => {
        return callback({
          getRepository: () => mockRefreshTokenRepo,
        });
      });

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      refreshTokenRepository.delete.mockResolvedValue({ affected: 1, raw: {} });

      const result = await authService.logout('some-refresh-token');

      expect(refreshTokenRepository.delete).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });

  describe('validateUserFromJwt', () => {
    it('should return user public data for valid payload', async () => {
      usersService.findById.mockResolvedValue(mockUser);

      const result = await authService.validateUserFromJwt({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });

      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toBeDefined();
      expect(result?.email).toBe(mockUser.email);
    });

    it('should return null if user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      const result = await authService.validateUserFromJwt({
        sub: 'unknown-id',
        email: 'unknown@example.com',
        role: Role.USER,
      });

      expect(result).toBeNull();
    });
  });
});
