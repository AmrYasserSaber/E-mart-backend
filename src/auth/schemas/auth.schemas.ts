import { Type, Static } from '@sinclair/typebox';
import {
  EmailSchema,
  PlainPasswordSchema,
  FirstNameSchema,
  LastNameSchema,
  UserPublicSchema,
} from '../../users/schemas/user.schema';

export const RegisterBodySchema = Type.Object({
  firstName: FirstNameSchema,
  lastName: LastNameSchema,
  email: EmailSchema,
  password: PlainPasswordSchema,
});

export type RegisterBody = Static<typeof RegisterBodySchema>;

export const LoginBodySchema = Type.Object({
  email: EmailSchema,
  password: PlainPasswordSchema,
});

export type LoginBody = Static<typeof LoginBodySchema>;

export const RefreshTokenBodySchema = Type.Object({
  refreshToken: Type.String({
    minLength: 1,
    description: 'Opaque refresh token',
  }),
});

export type RefreshTokenBody = Static<typeof RefreshTokenBodySchema>;

export const AuthTokensOnlyResponseSchema = Type.Object({
  accessToken: Type.String({ description: 'JWT access token' }),
  refreshToken: Type.String({ description: 'Opaque refresh token' }),
});

export type AuthTokensOnlyResponse = Static<
  typeof AuthTokensOnlyResponseSchema
>;

export const AuthTokensResponseSchema = Type.Object({
  accessToken: Type.String({ description: 'JWT access token' }),
  refreshToken: Type.String({ description: 'Opaque refresh token' }),
  user: UserPublicSchema,
});

export type AuthTokensResponse = Static<typeof AuthTokensResponseSchema>;

export const EmailVerificationCodeSchema = Type.String({
  pattern: '^[0-9]{6}$',
  description: '6-digit code from the confirmation email',
});

export const VerifyEmailBodySchema = Type.Object({
  email: EmailSchema,
  code: EmailVerificationCodeSchema,
});

export type VerifyEmailBody = Static<typeof VerifyEmailBodySchema>;

export const VerifyEmailResponseSchema = Type.Object({
  verified: Type.Literal(true),
  user: UserPublicSchema,
});

export type VerifyEmailResponse = Static<typeof VerifyEmailResponseSchema>;

export const RESEND_VERIFICATION_MESSAGE =
  'If your email is registered and awaiting verification, a new confirmation code was sent.' as const;

export const ResendVerificationBodySchema = Type.Object({
  email: EmailSchema,
});

export type ResendVerificationBody = Static<
  typeof ResendVerificationBodySchema
>;

export const ResendVerificationResponseSchema = Type.Object({
  message: Type.Literal(RESEND_VERIFICATION_MESSAGE),
});

export type ResendVerificationResponse = Static<
  typeof ResendVerificationResponseSchema
>;

export const LogoutResponseSchema = Type.Object({
  success: Type.Literal(true),
});

export type LogoutResponse = Static<typeof LogoutResponseSchema>;
