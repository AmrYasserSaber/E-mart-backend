import { Controller, Post, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import {
  RegisterBodySchema,
  LoginBodySchema,
  RefreshTokenBodySchema,
  AuthTokensResponseSchema,
  LogoutResponseSchema,
  type RegisterBody,
  type LoginBody,
  type RefreshTokenBody,
  type AuthTokensResponse,
} from './schemas/auth.schemas';
import { UserPublicSchema } from '../users/schemas/user.schema';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Validate({
    request: [{ type: 'body', schema: RegisterBodySchema }],
    response: { schema: AuthTokensResponseSchema, stripUnknownProps: true },
  })
  register(body: RegisterBody): Promise<AuthTokensResponse> {
    return this.authService.register(
      body.firstName,
      body.lastName,
      body.email,
      body.password,
    );
  }

  @Post('login')
  @Validate({
    request: [{ type: 'body', schema: LoginBodySchema }],
    response: { schema: AuthTokensResponseSchema, stripUnknownProps: true },
  })
  login(body: LoginBody): Promise<AuthTokensResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  @Validate({
    request: [{ type: 'body', schema: RefreshTokenBodySchema }],
    response: { schema: AuthTokensResponseSchema, stripUnknownProps: true },
  })
  refresh(body: RefreshTokenBody): Promise<AuthTokensResponse> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @Validate({
    request: [{ type: 'body', schema: RefreshTokenBodySchema }],
    response: { schema: LogoutResponseSchema, stripUnknownProps: true },
  })
  logout(body: RefreshTokenBody) {
    return this.authService.logout(body.refreshToken);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Validate({
    response: { schema: UserPublicSchema, stripUnknownProps: true },
  })
  me(@CurrentUser() user: UserPublic): UserPublic {
    return user;
  }
}
