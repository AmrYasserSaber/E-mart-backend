import { Controller, Post, Get, UseGuards, Req } from '@nestjs/common';
import type { Request } from 'express';
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
  type RegisterBody,
  type LoginBody,
  type RefreshTokenBody,
  type VerifyEmailBody,
  type VerifyEmailResponse,
  type ResendVerificationBody,
  type ResendVerificationResponse,
  type AuthTokensResponse,
  type AuthTokensOnlyResponse,
  RESEND_VERIFICATION_MESSAGE,
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
