import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { createHmac } from 'crypto';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { RESEND_VERIFICATION_MESSAGE } from './schemas/auth.schemas';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';
import { Seller, SellerStatus } from '../sellers/entities/seller.entity';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<Pick<MailService, 'sendConfirmationEmail'>>;
  let jwtService: jest.Mocked<JwtService>;
  let refreshTokenRepository: jest.Mocked<Repository<RefreshToken>>;
  let sellerRepository: jest.Mocked<Repository<Seller>>;
  let dataSource: jest.Mocked<DataSource>;

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
  };

  const mockVerifiedUser: User = {
    ...mockUser,
    emailVerifiedAt: new Date('2024-01-02T00:00:00.000Z'),
  };

  const mockRefreshToken: RefreshToken = {
    id: 'token-uuid-123',
    userId: mockVerifiedUser.id,
    user: mockVerifiedUser,
    tokenHash: 'hashed-refresh-token',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const mockUsersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      setEmailVerificationCode: jest.fn().mockResolvedValue(undefined),
      markEmailAsVerified: jest.fn(),
      validatePassword: jest.fn(),
    };

    const mockMailService = {
      sendConfirmationEmail: jest.fn().mockResolvedValue(undefined),
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

    const mockSellerRepository = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: MailService, useValue: mockMailService },
        { provide: JwtService, useValue: mockJwtService },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokenRepo,
        },
        {
          provide: getRepositoryToken(Seller),
          useValue: mockSellerRepository,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    mailService = module.get(MailService);
    jwtService = module.get(JwtService);
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    sellerRepository = module.get(getRepositoryToken(Seller));
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
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.email).toBe(mockUser.email);
      expect(usersService.setEmailVerificationCode).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Date),
      );
      expect(mailService.sendConfirmationEmail).toHaveBeenCalledTimes(1);
      const mailCall = mailService.sendConfirmationEmail.mock.calls[0];
      expect(mailCall[0]).toBe(mockUser.email);
      const mailPayload = mailCall[1] as {
        firstName: string;
        lastName: string;
        code: string;
      };
      expect(mailPayload.firstName).toBe(mockUser.firstName);
      expect(mailPayload.lastName).toBe(mockUser.lastName);
      expect(mailPayload.code).toMatch(/^\d{6}$/);
    });

    it('should throw ConflictException if email already exists', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.register('John', 'Doe', 'john@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(mailService.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('should create a pending seller request when registering as seller', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);
      const mockSeller = {
        id: 'seller-1',
        userId: mockUser.id,
        storeName: 'Green Store',
        description: 'Eco products for daily life',
        status: SellerStatus.PENDING,
        rating: 0,
        createdAt: new Date(),
      } as Seller;
      sellerRepository.create.mockReturnValue(mockSeller);
      sellerRepository.save.mockResolvedValue(mockSeller);
      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await authService.register(
        'John',
        'Doe',
        'john@example.com',
        'password123',
        Role.SELLER,
        'Green Store',
        'Eco products for daily life',
      );

      expect(sellerRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          storeName: 'Green Store',
          description: 'Eco products for daily life',
          status: SellerStatus.PENDING,
          rating: 0,
        }),
      );
      expect(sellerRepository.save).toHaveBeenCalledTimes(1);
      expect(result.user.role).toBe(Role.USER);
    });

    it('should reject admin role request at signup', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.register(
          'John',
          'Doe',
          'john@example.com',
          'password123',
          Role.ADMIN,
        ),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.create).not.toHaveBeenCalled();
      expect(sellerRepository.save).not.toHaveBeenCalled();
    });

    it('should require seller profile fields for seller signup', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(mockUser);

      await expect(
        authService.register(
          'John',
          'Doe',
          'john@example.com',
          'password123',
          Role.SELLER,
          '',
          '',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(sellerRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    const future = new Date(Date.now() + 60_000);
    const code = '123456';
    const codeHash = createHmac(
      'sha256',
      process.env.EMAIL_VERIFICATION_SECRET as string,
    )
      .update(code, 'utf8')
      .digest('hex');

    const userPendingVerification: User = {
      ...mockUser,
      emailVerifiedAt: null,
      emailVerificationCodeHash: codeHash,
      emailVerificationExpiresAt: future,
    };

    const userVerified: User = {
      ...mockUser,
      emailVerifiedAt: new Date('2024-06-01'),
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    };

    it('should verify email with valid code', async () => {
      usersService.findByEmail.mockResolvedValue(userPendingVerification);
      usersService.markEmailAsVerified.mockResolvedValue(userVerified);

      const result = await authService.verifyEmail('john@example.com', code);

      expect(usersService.markEmailAsVerified).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(result.verified).toBe(true);
    });

    it('should return verified when already verified (idempotent)', async () => {
      usersService.findByEmail.mockResolvedValue(userVerified);

      const result = await authService.verifyEmail(
        'john@example.com',
        '000000',
      );

      expect(usersService.markEmailAsVerified).not.toHaveBeenCalled();
      expect(result.verified).toBe(true);
    });

    it('should reject unknown email', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.verifyEmail('unknown@example.com', code),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.markEmailAsVerified).not.toHaveBeenCalled();
    });

    it('should reject wrong code', async () => {
      usersService.findByEmail.mockResolvedValue(userPendingVerification);

      await expect(
        authService.verifyEmail('john@example.com', '999999'),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.markEmailAsVerified).not.toHaveBeenCalled();
    });

    it('should reject expired code', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...userPendingVerification,
        emailVerificationExpiresAt: new Date(Date.now() - 60_000),
      });

      await expect(
        authService.verifyEmail('john@example.com', code),
      ).rejects.toThrow(BadRequestException);

      expect(usersService.markEmailAsVerified).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationEmail', () => {
    it('returns generic message when email is not registered', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result =
        await authService.resendVerificationEmail('nobody@example.com');

      expect(result).toEqual({ message: RESEND_VERIFICATION_MESSAGE });
      expect(usersService.setEmailVerificationCode).not.toHaveBeenCalled();
      expect(mailService.sendConfirmationEmail).not.toHaveBeenCalled();
    });

    it('throws when email is already verified', async () => {
      usersService.findByEmail.mockResolvedValue(mockVerifiedUser);

      const result =
        await authService.resendVerificationEmail('john@example.com');

      expect(usersService.setEmailVerificationCode).not.toHaveBeenCalled();
      expect(mailService.sendConfirmationEmail).not.toHaveBeenCalled();
      expect(result).toEqual({ message: RESEND_VERIFICATION_MESSAGE });
    });

    it('issues new code and sends mail for unverified user', async () => {
      const pending: User = {
        ...mockUser,
        emailVerifiedAt: null,
        emailVerificationCodeHash: 'old-hash',
        emailVerificationExpiresAt: new Date(Date.now() - 1000),
      };
      usersService.findByEmail.mockResolvedValue(pending);

      const result =
        await authService.resendVerificationEmail('john@example.com');

      expect(result).toEqual({ message: RESEND_VERIFICATION_MESSAGE });
      expect(usersService.setEmailVerificationCode).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(String),
        expect.any(Date),
      );
      expect(mailService.sendConfirmationEmail).toHaveBeenCalledWith(
        'john@example.com',
        expect.objectContaining({
          firstName: pending.firstName,
          lastName: pending.lastName,
          code: expect.stringMatching(/^\d{6}$/),
        }),
      );
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      usersService.findByEmail.mockResolvedValue(mockVerifiedUser);
      usersService.validatePassword.mockResolvedValue(true);
      refreshTokenRepository.create.mockReturnValue(mockRefreshToken);
      refreshTokenRepository.save.mockResolvedValue(mockRefreshToken);

      const result = await authService.login('john@example.com', 'password123');

      expect(usersService.findByEmail).toHaveBeenCalledWith('john@example.com');
      expect(usersService.validatePassword).toHaveBeenCalledWith(
        mockVerifiedUser,
        'password123',
      );
      expect(result).toHaveProperty('accessToken', 'mock-access-token');
      expect(result).toHaveProperty('refreshToken');
      expect(result).not.toHaveProperty('user');
    });

    it('should reject login when email is not verified', async () => {
      usersService.findByEmail.mockResolvedValue(mockUser);
      usersService.validatePassword.mockResolvedValue(true);

      await expect(
        authService.login('john@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login('unknown@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);

      expect(usersService.validatePassword).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException if password is invalid', async () => {
      usersService.findByEmail.mockResolvedValue(mockVerifiedUser);
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

      dataSource.transaction.mockImplementation(((...args: unknown[]) => {
        const callback = args[0] ?? args[1];
        return (callback as (m: unknown) => unknown)({
          getRepository: () => mockRefreshTokenRepo,
        });
      }) as never);

      const result = await authService.refresh('valid-refresh-token');

      expect(dataSource.transaction).toHaveBeenCalled();
      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
    });

    it('should reject refresh when email is not verified', async () => {
      const unverifiedRefresh = {
        ...mockRefreshToken,
        user: mockUser,
      };

      const mockRefreshTokenRepo = {
        findOne: jest.fn().mockResolvedValue(unverifiedRefresh),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction.mockImplementation(((...args: unknown[]) => {
        const callback = args[0] ?? args[1];
        return (callback as (m: unknown) => unknown)({
          getRepository: () => mockRefreshTokenRepo,
        });
      }) as never);

      await expect(authService.refresh('valid-refresh-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      const mockRefreshTokenRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };

      dataSource.transaction.mockImplementation(((...args: unknown[]) => {
        const callback = args[0] ?? args[1];
        return (callback as (m: unknown) => unknown)({
          getRepository: () => mockRefreshTokenRepo,
        });
      }) as never);

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

      dataSource.transaction.mockImplementation(((...args: unknown[]) => {
        const callback = args[0] ?? args[1];
        return (callback as (m: unknown) => unknown)({
          getRepository: () => mockRefreshTokenRepo,
        });
      }) as never);

      await expect(authService.refresh('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockRefreshTokenRepo.delete).toHaveBeenCalledTimes(1);
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
