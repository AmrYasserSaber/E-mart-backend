import { Type, Static } from '@sinclair/typebox';
import { Role } from '../../common/enums/role.enum';

export const FirstNameSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  description: 'User first name',
});

export const LastNameSchema = Type.String({
  minLength: 1,
  maxLength: 100,
  description: 'User last name',
});

export const EmailSchema = Type.String({
  format: 'email',
  description: 'User email address',
  examples: ['user@example.com'],
});

export const PlainPasswordSchema = Type.String({
  minLength: 8,
  maxLength: 72,
  description: 'Plain text password (min 8 characters)',
});

export const RoleSchema = Type.Enum(Role, {
  description: 'User role (USER or ADMIN)',
});

export const UserPublicSchema = Type.Object({
  id: Type.String({ format: 'uuid', description: 'User ID' }),
  firstName: FirstNameSchema,
  lastName: LastNameSchema,
  email: EmailSchema,
  role: RoleSchema,
  createdAt: Type.String({
    format: 'date-time',
    description: 'Account creation timestamp',
  }),
});

export type UserPublicPayload = Static<typeof UserPublicSchema>;
