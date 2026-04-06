import { Controller, Post, Get, UseGuards, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiBody,
  ApiOkResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import type { UserPublic } from '../users/entities/user.entity';
import type { GoogleUserProfile } from './strategies/google.strategy';
import { env } from '../config/env';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { OAuthStateService } from './services/oauth-state.service';
import { GoogleOAuthService } from './services/google-oauth.service';
import { OAuthExchangeCodeService } from './services/oauth-exchange-code.service';
import { UsersService } from '../users/users.service';
import { UnauthorizedException } from '@nestjs/common';
import {
  RegisterBodySchema,
  LoginBodySchema,
  RefreshTokenBodySchema,
  AuthTokensResponseSchema,
  AuthTokensOnlyResponseSchema,
  VerifyEmailBodySchema,
  VerifyEmailResponseSchema,
  ResendVerificationBodySchema,
  ResendVerificationResponseSchema,
  LogoutResponseSchema,
  OAuthExchangeBodySchema,
  type RegisterBody,
  type LoginBody,
  type RefreshTokenBody,
  type VerifyEmailBody,
  type VerifyEmailResponse,
  type ResendVerificationBody,
  type ResendVerificationResponse,
  type AuthTokensResponse,
  type AuthTokensOnlyResponse,
  type OAuthExchangeBody,
  RESEND_VERIFICATION_MESSAGE,
} from './schemas/auth.schemas';
import { UserPublicSchema } from '../users/schemas/user.schema';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly oauthStateService: OAuthStateService,
    private readonly googleOAuthService: GoogleOAuthService,
    private readonly oauthExchangeCodeService: OAuthExchangeCodeService,
  ) {}

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
  @ApiOperation({
    summary: 'Log in',
    description:
      'Returns access and refresh tokens only. Email must be verified. Load profile with GET /auth/me using the access token.',
  })
  @ApiOkResponse({
    description: 'Tokens only (inside response `data`)',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        refreshToken: { type: 'string' },
      },
    },
  })
  @Validate({
    request: [{ type: 'body', schema: LoginBodySchema }],
    response: { schema: AuthTokensOnlyResponseSchema, stripUnknownProps: true },
  })
  login(body: LoginBody): Promise<AuthTokensOnlyResponse> {
    return this.authService.login(body.email, body.password);
  }

  @Post('verify-email')
  @ApiOperation({
    summary: 'Verify email',
    description:
      'Submit the 6-digit code sent to the user after registration. Response is wrapped by the global envelope (success, data, …).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'code'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
        code: {
          type: 'string',
          pattern: '^[0-9]{6}$',
          example: '123456',
          description: 'Six-digit code from the confirmation email',
        },
      },
    },
  })
  @ApiOkResponse({
    description: 'Email verified (payload inside response `data`)',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean', enum: [true] },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired verification code',
  })
  @Validate({
    request: [{ type: 'body', schema: VerifyEmailBodySchema }],
    response: { schema: VerifyEmailResponseSchema, stripUnknownProps: true },
  })
  verifyEmail(body: VerifyEmailBody): Promise<VerifyEmailResponse> {
    return this.authService.verifyEmail(body.email, body.code);
  }

  @Post('resend-verification')
  @ApiOperation({
    summary: 'Resend email verification code',
    description:
      'Issues a new 6-digit code (24h validity) for pending verification. Response is the same whether the email exists or is already verified (to avoid account enumeration).',
  })
  @ApiBody({
    description: 'Email address used at registration',
    schema: {
      type: 'object',
      required: ['email'],
      properties: {
        email: { type: 'string', format: 'email', example: 'user@example.com' },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Acknowledgment (payload inside response `data`, same shape whether or not the email exists)',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: RESEND_VERIFICATION_MESSAGE,
          description:
            'Fixed message; identical for unknown emails to reduce account enumeration',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid body (e.g. malformed email)',
  })
  @Validate({
    request: [{ type: 'body', schema: ResendVerificationBodySchema }],
    response: {
      schema: ResendVerificationResponseSchema,
      stripUnknownProps: true,
    },
  })
  resendVerification(
    body: ResendVerificationBody,
  ): Promise<ResendVerificationResponse> {
    return this.authService.resendVerificationEmail(body.email);
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

  @Get('admin/test')
  @ApiOperation({ summary: 'Auth smoke test' })
  adminTest(): { ok: true } {
    return { ok: true };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin(): void {
    // Passport redirect.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(
    @Req()
    req: Request & { user: GoogleUserProfile; query: { state?: string } },
    @Res() res: Response,
  ): Promise<void> {
    const statePayload = this.oauthStateService.executeVerifyState(
      req.query.state,
    );
    const user =
      await this.googleOAuthService.findOrCreateUserFromGoogleProfile(req.user);
    const exchangeCode = await this.oauthExchangeCodeService.createExchangeCode(
      {
        userId: user.id,
        returnUrl: statePayload.returnUrl,
      },
    );
    const redirectUrl = new URL('/auth/oauth-callback', env.FRONTEND_URL);
    redirectUrl.searchParams.set('code', exchangeCode);
    res.redirect(redirectUrl.toString());
  }

  @Post('oauth/exchange')
  @Validate({
    request: [{ type: 'body', schema: OAuthExchangeBodySchema }],
    response: { schema: AuthTokensOnlyResponseSchema, stripUnknownProps: true },
  })
  async exchangeOAuthCode(
    body: OAuthExchangeBody,
  ): Promise<AuthTokensOnlyResponse> {
    const consumed = await this.oauthExchangeCodeService.consumeExchangeCode(
      body.code,
    );
    const user = await this.usersService.findById(consumed.userId);
    if (!user) {
      throw new UnauthorizedException('User not found.');
    }
    return this.authService.issueTokens(user, false);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Current user profile',
    description:
      'Requires Bearer access token (e.g. from login). Returns public profile fields from the database.',
  })
  @Validate({
    response: { schema: UserPublicSchema, stripUnknownProps: true },
  })
  me(@Req() req: Request & { user: UserPublic }): UserPublic {
    return req.user;
  }
}
