import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { UsersService } from '../users/users.service';
import { User, UserPublic, toUserPublic } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { env } from '../config/env';
import type { AuthTokensResponse } from './schemas/auth.schemas';
import type { JwtPayload } from './types/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly dataSource: DataSource,
  ) {}

  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private getRefreshExpiresAt(): Date {
    const expiresIn = env.JWT_REFRESH_EXPIRES_IN;
    const ms = this.parseExpiresIn(expiresIn);
    return new Date(Date.now() + ms);
  }

  private parseExpiresIn(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // default 7 days
    }
    const num = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return num * 1000;
      case 'm':
        return num * 60 * 1000;
      case 'h':
        return num * 60 * 60 * 1000;
      case 'd':
        return num * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private async issueTokens(user: User): Promise<AuthTokensResponse> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };
    const accessToken = this.jwtService.sign(payload);

    const rawRefreshToken = this.generateRefreshToken();
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const expiresAt = this.getRefreshExpiresAt();

    const refreshTokenEntity = this.refreshTokenRepository.create({
      userId: user.id,
      tokenHash,
      expiresAt,
    });
    await this.refreshTokenRepository.save(refreshTokenEntity);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      user: toUserPublic(user),
    };
  }

  async register(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
  ): Promise<AuthTokensResponse> {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const user = await this.usersService.create(
      firstName,
      lastName,
      email,
      password,
    );
    return this.issueTokens(user);
  }

  async login(email: string, password: string): Promise<AuthTokensResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.usersService.validatePassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user);
  }

  async refresh(rawRefreshToken: string): Promise<AuthTokensResponse> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);

    return this.dataSource.transaction(async (manager) => {
      const refreshTokenRepo = manager.getRepository(RefreshToken);

      const existingToken = await refreshTokenRepo.findOne({
        where: { tokenHash },
        relations: ['user'],
      });

      if (!existingToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (existingToken.expiresAt < new Date()) {
        await refreshTokenRepo.delete({ id: existingToken.id });
        throw new UnauthorizedException('Refresh token expired');
      }

      await refreshTokenRepo.delete({ id: existingToken.id });

      const user = existingToken.user;
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      const payload: JwtPayload = {
        sub: user.id,
        email: user.email,
        role: user.role,
      };
      const accessToken = this.jwtService.sign(payload);

      const newRawRefreshToken = this.generateRefreshToken();
      const newTokenHash = this.hashRefreshToken(newRawRefreshToken);
      const expiresAt = this.getRefreshExpiresAt();

      const newRefreshToken = refreshTokenRepo.create({
        userId: user.id,
        tokenHash: newTokenHash,
        expiresAt,
      });
      await refreshTokenRepo.save(newRefreshToken);

      return {
        accessToken,
        refreshToken: newRawRefreshToken,
        user: toUserPublic(user),
      };
    });
  }

  async logout(rawRefreshToken: string): Promise<{ success: true }> {
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.refreshTokenRepository.delete({ tokenHash });
    return { success: true };
  }

  async validateUserFromJwt(payload: JwtPayload): Promise<UserPublic | null> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      return null;
    }
    return toUserPublic(user);
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.refreshTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(`Cleaned up ${result.affected} expired refresh tokens`);
    }
  }
}
