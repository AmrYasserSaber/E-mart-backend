import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { RefreshToken } from './entities/refresh-token.entity';
import { OAuthExchangeCode } from './entities/oauth-exchange-code.entity';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';
import { jwtConfig } from '../config/jwt.config';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { OAuthStateService } from './services/oauth-state.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthExchangeCodeService } from './services/oauth-exchange-code.service';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    MailModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({ useFactory: jwtConfig }),
    TypeOrmModule.forFeature([RefreshToken, OAuthExchangeCode, User]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    OAuthStateService,
    GoogleOAuthService,
    OAuthExchangeCodeService,
    GoogleAuthGuard,
    JwtAuthGuard,
    RolesGuard,
  ],
  exports: [JwtAuthGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
