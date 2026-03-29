import { Type, Static } from '@sinclair/typebox';
import { Role } from '../../common/enums/role.enum';
import { UserPublicSchema } from '../../users/schemas/user.schema';
import {
  OrderResponseSchema,
  OrderStatusSchema,
  UpdateOrderStatusResponseSchema,
} from '../../orders/schemas/order.schema';

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

export const ManageUserBodySchema = Type.Object(
  {
    role: Type.Optional(Type.Enum(Role)),
    active: Type.Optional(Type.Boolean()),
  },
  { minProperties: 1 },
);

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

export const ListAdminOrdersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  userId: Type.Optional(Type.String({ format: 'uuid' })),
  status: Type.Optional(OrderStatusSchema),
});

export type ListAdminOrdersQuery = Static<typeof ListAdminOrdersQuerySchema>;

export const ListAdminOrdersResponseSchema = Type.Object({
  data: Type.Array(OrderResponseSchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

export type ListAdminOrdersResponse = Static<
  typeof ListAdminOrdersResponseSchema
>;

export const ManageOrderStatusBodySchema = Type.Object({
  status: OrderStatusSchema,
});

export type ManageOrderStatusBody = Static<typeof ManageOrderStatusBodySchema>;

export const ManageOrderStatusResponseSchema = UpdateOrderStatusResponseSchema;

export type ManageOrderStatusResponse = Static<
  typeof ManageOrderStatusResponseSchema
>;

export const ApproveSellerStoreResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  status: Type.String(),
  approvedAt: Type.String({ format: 'date-time' }),
});

export type ApproveSellerStoreResponse = Static<
  typeof ApproveSellerStoreResponseSchema
>;

export const ListPendingSellersQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
});

export type ListPendingSellersQuery = Static<
  typeof ListPendingSellersQuerySchema
>;

export const PendingSellerItemSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  storeName: Type.String(),
  description: Type.String(),
  status: Type.String(),
  rating: Type.Number({ minimum: 0 }),
  createdAt: Type.String({ format: 'date-time' }),
});

export const ListPendingSellersResponseSchema = Type.Object({
  data: Type.Array(PendingSellerItemSchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
  limit: Type.Integer({ minimum: 1 }),
  totalPages: Type.Integer({ minimum: 0 }),
});

export type ListPendingSellersResponse = Static<
  typeof ListPendingSellersResponseSchema
>;
