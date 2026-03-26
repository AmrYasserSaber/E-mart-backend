import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '../common/enums/role.enum';
import type { UserPublic } from '../users/entities/user.entity';
import type {
  AuthTokensResponse,
  AuthTokensOnlyResponse,
} from './schemas/auth.schemas';
import { RESEND_VERIFICATION_MESSAGE } from './schemas/auth.schemas';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockUserPublic: UserPublic = {
    id: 'user-uuid-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: Role.USER,
    createdAt: '2024-01-01T00:00:00.000Z',
  };

  const mockAuthTokensResponse: AuthTokensResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    user: mockUserPublic,
  };

  const mockLoginTokensResponse: AuthTokensOnlyResponse = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      verifyEmail: jest.fn(),
      resendVerificationEmail: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      validateUserFromJwt: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should call authService.register with correct arguments', async () => {
      authService.register.mockResolvedValue(mockAuthTokensResponse);

      const body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      const result = await controller.register(body);

      expect(authService.register).toHaveBeenCalledWith(
        body.firstName,
        body.lastName,
        body.email,
        body.password,
      );
      expect(result).toEqual(mockAuthTokensResponse);
    });
  });

  describe('verifyEmail', () => {
    it('should call authService.verifyEmail with correct arguments', async () => {
      const verifyResponse = { verified: true as const };
      authService.verifyEmail.mockResolvedValue(verifyResponse);

      const body = { email: 'john@example.com', code: '123456' };

      const result = await controller.verifyEmail(body);

      expect(authService.verifyEmail).toHaveBeenCalledWith(
        body.email,
        body.code,
      );
      expect(result).toEqual(verifyResponse);
    });
  });

  describe('resendVerification', () => {
    it('should call authService.resendVerificationEmail with email', async () => {
      const res = { message: RESEND_VERIFICATION_MESSAGE };
      authService.resendVerificationEmail.mockResolvedValue(res);

      const body = { email: 'john@example.com' };
      const result = await controller.resendVerification(body);

      expect(authService.resendVerificationEmail).toHaveBeenCalledWith(
        body.email,
      );
      expect(result).toEqual(res);
    });
  });

  describe('login', () => {
    it('should call authService.login with correct arguments', async () => {
      authService.login.mockResolvedValue(mockLoginTokensResponse);

      const body = {
        email: 'john@example.com',
        password: 'password123',
      };

      const result = await controller.login(body);

      expect(authService.login).toHaveBeenCalledWith(body.email, body.password);
      expect(result).toEqual(mockLoginTokensResponse);
    });
  });

  describe('refresh', () => {
    it('should call authService.refresh with correct arguments', async () => {
      authService.refresh.mockResolvedValue(mockAuthTokensResponse);

      const body = { refreshToken: 'mock-refresh-token' };

      const result = await controller.refresh(body);

      expect(authService.refresh).toHaveBeenCalledWith(body.refreshToken);
      expect(result).toEqual(mockAuthTokensResponse);
    });
  });

  describe('logout', () => {
    it('should call authService.logout with correct arguments', async () => {
      authService.logout.mockResolvedValue({ success: true });

      const body = { refreshToken: 'mock-refresh-token' };

      const result = await controller.logout(body);

      expect(authService.logout).toHaveBeenCalledWith(body.refreshToken);
      expect(result).toEqual({ success: true });
    });
  });

  describe('me', () => {
    it('should return req.user directly', () => {
      const req = {
        user: mockUserPublic,
      };

      const result = controller.me(req as never);

      expect(result).toEqual(mockUserPublic);
    });
  });
});
