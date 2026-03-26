import { Type, Static } from '@sinclair/typebox';
import { Role } from '../../common/enums/role.enum';
import { UserPublicSchema } from '../../users/schemas/user.schema';

export const ListUsersQuerySchema = Type.Object(
  {
    page: Type.Optional(
      Type.Integer({
        minimum: 1,
        description: 'Page number (>= 1)',
        errorMessage: 'page must be an integer >= 1',
      }),
    ),
    limit: Type.Optional(
      Type.Integer({
        minimum: 1,
        description: 'Items per page (>= 1)',
        errorMessage: 'limit must be an integer >= 1',
      }),
    ),
    search: Type.Optional(
      Type.String({
        minLength: 1,
        errorMessage: 'search must be a non-empty string',
      }),
    ),
    role: Type.Optional(
      Type.Enum(Role, { errorMessage: 'role must be one of: admin, user' }),
    ),
    active: Type.Optional(
      Type.Union(
        [Type.Boolean(), Type.Literal('true'), Type.Literal('false')],
        {
          errorMessage: 'active must be a boolean',
        },
      ),
    ),
  },
  { description: 'Invalid admin users query params' },
);

export type ListUsersQuery = Static<typeof ListUsersQuerySchema>;

export const ManageUserBodySchema = Type.Object({
  role: Type.Optional(Type.Enum(Role)),
  active: Type.Optional(Type.Boolean()),
});

export type ManageUserBody = Static<typeof ManageUserBodySchema>;

export const ListUsersResponseSchema = Type.Object({
  items: Type.Array(UserPublicSchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

export type ListUsersResponse = Static<typeof ListUsersResponseSchema>;

export const ManageUserResponseSchema = UserPublicSchema;
