import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { GoogleOAuthService } from './google-oauth.service';
import { User } from '../../users/entities/user.entity';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import type { GoogleUserProfile } from '../strategies/google.strategy';
import { Role } from '../../common/enums/role.enum';

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService;
  let userRepository: jest.Mocked<Repository<User>>;

  const profile: GoogleUserProfile = {
    googleId: 'google-1',
    email: 'john@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(async () => {
    const mockRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleOAuthService,
        { provide: getRepositoryToken(User), useValue: mockRepo },
      ],
    }).compile();

    service = module.get(GoogleOAuthService);
    userRepository = module.get(getRepositoryToken(User));
  });

  it('returns existing user by googleId', async () => {
    const existing: User = {
      id: 'u1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      authProvider: AuthProvider.GOOGLE,
      googleId: 'google-1',
      passwordHash: null,
      role: Role.USER,
      createdAt: new Date(),
      active: true,
      updatedAt: new Date(),
      emailVerifiedAt: new Date(),
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    };
    userRepository.findOne.mockResolvedValueOnce(existing);

    const result = await service.findOrCreateUserFromGoogleProfile(profile);

    expect(result).toBe(existing);
  });

  it('links googleId to existing user by email', async () => {
    userRepository.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: 'u1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      authProvider: AuthProvider.LOCAL,
      googleId: null,
      passwordHash: 'hash',
      role: Role.USER,
      createdAt: new Date(),
      active: true,
      updatedAt: new Date(),
      emailVerifiedAt: null,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    } as User);
    userRepository.save.mockImplementation(async (u) => u as never);

    const result = await service.findOrCreateUserFromGoogleProfile(profile);

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        googleId: 'google-1',
        authProvider: AuthProvider.GOOGLE,
      }),
    );
    expect(result.googleId).toBe('google-1');
    expect(result.emailVerifiedAt).not.toBeNull();
  });

  it('creates new google user when no match exists', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.create.mockImplementation((u) => u as never);
    userRepository.save.mockImplementation(
      async (u) => ({ ...u, id: 'new' }) as never,
    );

    const result = await service.findOrCreateUserFromGoogleProfile(profile);

    expect(userRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'john@example.com',
        googleId: 'google-1',
        passwordHash: null,
        authProvider: AuthProvider.GOOGLE,
      }),
    );
    expect(result.id).toBe('new');
  });
});
