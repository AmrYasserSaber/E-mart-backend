import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'crypto';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { User, UserPublic, toUserPublic } from '../users/entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { env } from '../config/env';
import { Role } from '../common/enums/role.enum';
import { Seller, SellerStatus } from '../sellers/entities/seller.entity';
import {
  RESEND_VERIFICATION_MESSAGE,
  type AuthTokensResponse,
  type AuthTokensOnlyResponse,
  type VerifyEmailResponse,
  type ResendVerificationResponse,
} from './schemas/auth.schemas';
import type { JwtPayload } from './types/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(Seller)
    private readonly sellerRepository: Repository<Seller>,
    private readonly dataSource: DataSource,
  ) {}

  private assertValidSellerSignupPayload(
    storeName?: string,
    description?: string,
  ): { storeName: string; description: string } {
    const normalizedStoreName = storeName?.trim() ?? '';
    const normalizedDescription = description?.trim() ?? '';

    if (!normalizedStoreName) {
      throw new BadRequestException(
        'storeName is required when role is seller',
      );
    }
    if (!normalizedDescription) {
      throw new BadRequestException(
        'description is required when role is seller',
      );
    }

    return {
      storeName: normalizedStoreName,
      description: normalizedDescription,
    };
  }

  private hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  private generateEmailVerificationCode(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  private hashEmailVerificationCode(code: string): string {
    return createHmac('sha256', env.EMAIL_VERIFICATION_SECRET)
      .update(code, 'utf8')
      .digest('hex');
  }

  private requireVerifiedEmail(user: User): void {
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException(
        'Please verify your email before signing in.',
      );
    }
  }

  private compareEmailVerificationHashes(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a, 'hex');
      const bufB = Buffer.from(b, 'hex');
      if (bufA.length !== bufB.length) {
        return false;
      }
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
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

  async issueTokens(user: User, includeUser: true): Promise<AuthTokensResponse>;
  async issueTokens(
    user: User,
    includeUser: false,
  ): Promise<AuthTokensOnlyResponse>;
  async issueTokens(
    user: User,
    includeUser: boolean,
  ): Promise<AuthTokensResponse | AuthTokensOnlyResponse> {
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

    if (includeUser) {
      return {
        accessToken,
        refreshToken: rawRefreshToken,
        user: toUserPublic(user),
      };
    }

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  }

  async register(
    firstName: string,
    lastName: string,
    email: string,
    password: string,
    role: Role = Role.USER,
    storeName?: string,
    description?: string,
  ): Promise<AuthTokensResponse> {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    if (role === Role.ADMIN) {
      throw new BadRequestException('Admin role cannot be requested at signup');
    }

    const user = await this.usersService.create(
      firstName,
      lastName,
      email,
      password,
    );

    if (role === Role.SELLER) {
      const sellerPayload = this.assertValidSellerSignupPayload(
        storeName,
        description,
      );
      const seller = this.sellerRepository.create({
        userId: user.id,
        storeName: sellerPayload.storeName,
        description: sellerPayload.description,
        status: SellerStatus.PENDING,
        rating: 0,
      });
      await this.sellerRepository.save(seller);
    }

    const code = this.generateEmailVerificationCode();
    const codeHash = this.hashEmailVerificationCode(code);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.usersService.setEmailVerificationCode(
      user.id,
      codeHash,
      expiresAt,
    );

    try {
      await this.mailService.sendConfirmationEmail(user.email, {
        firstName: user.firstName,
        lastName: user.lastName,
        code,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send confirmation email for userId=${user.id}`,
        err instanceof Error ? err.stack : err,
      );
    }

    return this.issueTokens(user, true);
  }

  async verifyEmail(email: string, code: string): Promise<VerifyEmailResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (user.emailVerifiedAt) {
      // Anti-enumeration: do not return any account/profile data for public verification calls.
      return { verified: true };
    }

    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    if (user.emailVerificationExpiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    const submittedHash = this.hashEmailVerificationCode(code.trim());
    if (
      !this.compareEmailVerificationHashes(
        submittedHash,
        user.emailVerificationCodeHash,
      )
    ) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    await this.usersService.markEmailAsVerified(user.id);
    return { verified: true };
  }

  async resendVerificationEmail(
    email: string,
  ): Promise<ResendVerificationResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { message: RESEND_VERIFICATION_MESSAGE };
    }

    // Anti-enumeration: return the same generic message whether the email is already verified
    // or pending verification.
    if (user.emailVerifiedAt) {
      return { message: RESEND_VERIFICATION_MESSAGE };
    }

    const code = this.generateEmailVerificationCode();
    const codeHash = this.hashEmailVerificationCode(code);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.usersService.setEmailVerificationCode(
      user.id,
      codeHash,
      expiresAt,
    );

    try {
      await this.mailService.sendConfirmationEmail(user.email, {
        firstName: user.firstName,
        lastName: user.lastName,
        code,
      });
    } catch (err) {
      this.logger.warn(
        `Failed to send confirmation email for userId=${user.id}`,
        err instanceof Error ? err.stack : err,
      );
    }

    return { message: RESEND_VERIFICATION_MESSAGE };
  }

  async login(
    email: string,
    password: string,
  ): Promise<AuthTokensOnlyResponse> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.usersService.validatePassword(user, password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.requireVerifiedEmail(user);

    return this.issueTokens(user, false);
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
        await refreshTokenRepo.delete({ id: existingToken.id, tokenHash });
        throw new UnauthorizedException('Refresh token expired');
      }

      const user = existingToken.user;
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      const deleteResult = await refreshTokenRepo.delete({
        id: existingToken.id,
        tokenHash,
      });
      if (deleteResult.affected !== 1) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      this.requireVerifiedEmail(user);

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
