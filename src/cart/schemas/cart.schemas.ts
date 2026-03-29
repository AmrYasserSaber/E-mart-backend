import { Type, Static } from '@sinclair/typebox';

export const CartItemIdParamSchema = Type.String({
  format: 'uuid',
  description: 'CartItem id',
});

export const AddToCartBodySchema = Type.Object({
  productId: Type.String({ format: 'uuid' }),
  quantity: Type.Integer({ minimum: 1, default: 1 }),
});

export type AddToCartBody = Static<typeof AddToCartBodySchema>;

export const UpdateCartItemBodySchema = Type.Object({
  quantity: Type.Integer({ minimum: 1 }),
});

export type UpdateCartItemBody = Static<typeof UpdateCartItemBodySchema>;
