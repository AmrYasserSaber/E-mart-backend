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

export const AuthTokensResponseSchema = Type.Object({
  accessToken: Type.String({ description: 'JWT access token' }),
  refreshToken: Type.String({ description: 'Opaque refresh token' }),
  user: UserPublicSchema,
});

export type AuthTokensResponse = Static<typeof AuthTokensResponseSchema>;

export const LogoutResponseSchema = Type.Object({
  success: Type.Literal(true),
});

export type LogoutResponse = Static<typeof LogoutResponseSchema>;
