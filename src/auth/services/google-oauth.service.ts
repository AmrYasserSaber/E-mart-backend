import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import type { GoogleUserProfile } from '../strategies/google.strategy';
import { Role } from '../../common/enums/role.enum';

@Injectable()
export class GoogleOAuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findOrCreateUserFromGoogleProfile(
    profile: GoogleUserProfile,
  ): Promise<User> {
    const existingByGoogleId = await this.userRepository.findOne({
      where: { googleId: profile.googleId },
    });
    if (existingByGoogleId) {
      if (!existingByGoogleId.emailVerifiedAt) {
        existingByGoogleId.emailVerifiedAt = new Date();
        await this.userRepository.save(existingByGoogleId);
      }
      return existingByGoogleId;
    }

    const normalizedEmail = profile.email.trim().toLowerCase();
    const existingByEmail = await this.userRepository.findOne({
      where: { email: normalizedEmail },
    });
    if (existingByEmail) {
      existingByEmail.googleId = profile.googleId;
      if (!existingByEmail.emailVerifiedAt) {
        existingByEmail.emailVerifiedAt = new Date();
      }
      if (existingByEmail.authProvider === AuthProvider.LOCAL) {
        existingByEmail.authProvider = AuthProvider.GOOGLE;
      }
      return this.userRepository.save(existingByEmail);
    }

    const user = this.userRepository.create({
      firstName: profile.firstName.trim(),
      lastName: profile.lastName.trim(),
      email: normalizedEmail,
      authProvider: AuthProvider.GOOGLE,
      googleId: profile.googleId,
      passwordHash: null,
      role: Role.USER,
      emailVerifiedAt: new Date(),
      active: true,
    });
    return this.userRepository.save(user);
  }
}
