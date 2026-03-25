import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '../common/enums/role.enum';
import type { UserPublic } from '../users/entities/user.entity';
import type { AuthTokensResponse } from './schemas/auth.schemas';

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
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    user: mockUserPublic,
  };

  beforeEach(async () => {
    const mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
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

  describe('login', () => {
    it('should call authService.login with correct arguments', async () => {
      authService.login.mockResolvedValue(mockAuthTokensResponse);

      const body = {
        email: 'john@example.com',
        password: 'password123',
      };

      const result = await controller.login(body);

      expect(authService.login).toHaveBeenCalledWith(body.email, body.password);
      expect(result).toEqual(mockAuthTokensResponse);
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
    it('should return the current user from decorator', () => {
      const result = controller.me(mockUserPublic);

      expect(result).toEqual(mockUserPublic);
    });
  });
});
