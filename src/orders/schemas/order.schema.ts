import { Static, Type } from '@sinclair/typebox';
import { OrderStatus } from '../entities/order.entity';

export const UuidSchema = Type.String({
  format: 'uuid',
  description: 'UUID identifier',
});

export const ProductItemSchema = Type.Object({
  productId: Type.String({
    format: 'uuid',
    description: 'Product ID',
  }),
  title: Type.String({
    minLength: 1,
    maxLength: 255,
    description: 'Product title at ordering time',
  }),
  qty: Type.Integer({
    minimum: 1,
    description: 'Requested quantity',
  }),
  price: Type.Number({
    minimum: 0,
    description: 'Unit price',
  }),
});

export const OrderStatusSchema = Type.Enum(OrderStatus, {
  description: 'Order lifecycle status',
});

export const CreateOrderBodySchema = Type.Object({
  shippingAddress: ShippingAddressSchema,
  paymentMethod: Type.String({ minLength: 1, maxLength: 50 }),
  addressId: UuidSchema,
});

export type CreateOrderBody = Static<typeof CreateOrderBodySchema>;

export const UpdateOrderBodySchema = Type.Object({
  addressId: UuidSchema,
});

export type UpdateOrderBody = Static<typeof UpdateOrderBodySchema>;

export const UpdateOrderStatusBodySchema = Type.Object({
  status: OrderStatusSchema,
});

export type UpdateOrderStatusBody = Static<typeof UpdateOrderStatusBodySchema>;

export const OrderResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  items: Type.Array(ProductItemSchema),
  total: Type.Number({ minimum: 0 }),
  status: OrderStatusSchema,
  shippingAddress: ShippingAddressSchema,
  paymentMethod: Type.String(),
  shippingAddressId: Type.Union([UuidSchema, Type.Null()]),
  paymentIntentId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type OrderResponse = Static<typeof OrderResponseSchema>;

export const DeleteOrderResponseSchema = Type.Object({
  success: Type.Literal(true),
});

export type DeleteOrderResponse = Static<typeof DeleteOrderResponseSchema>;

export const OrderListItemSchema = Type.Object({
  id: UuidSchema,
  total: Type.Number({ minimum: 0 }),
  status: OrderStatusSchema,
  itemsCount: Type.Integer({ minimum: 0 }),
  createdAt: Type.String({ format: 'date-time' }),
});

export type OrderListItem = Static<typeof OrderListItemSchema>;

export const OrdersListResponseSchema = Type.Object({
  data: Type.Array(OrderListItemSchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
});

export type OrdersListResponse = Static<typeof OrdersListResponseSchema>;

export const OrderDetailsItemSchema = Type.Object({
  product: Type.Object({
    id: UuidSchema,
    title: Type.String({ minLength: 1, maxLength: 255 }),
  }),
  qty: Type.Integer({ minimum: 1 }),
  price: Type.Number({ minimum: 0 }),
});

export const OrderDetailsResponseSchema = Type.Object({
  id: UuidSchema,
  items: Type.Array(OrderDetailsItemSchema),
  total: Type.Number({ minimum: 0 }),
  status: OrderStatusSchema,
  shippingAddressId: Type.Union([UuidSchema, Type.Null()]),
  payment: Type.Object({
    method: Type.String(),
    provider: Type.Literal('stripe'),
    status: Type.String({ minLength: 1 }),
  }),
  createdAt: Type.String({ format: 'date-time' }),
});

export type OrderDetailsResponse = Static<typeof OrderDetailsResponseSchema>;

export const UpdateOrderStatusResponseSchema = Type.Object({
  id: UuidSchema,
  status: OrderStatusSchema,
  updatedAt: Type.String({ format: 'date-time' }),
});

export type UpdateOrderStatusResponse = Static<
  typeof UpdateOrderStatusResponseSchema
>;
