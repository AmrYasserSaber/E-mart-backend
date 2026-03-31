import { Type, Static } from '@sinclair/typebox';

export const WishlistProductIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Product ID',
});

export const AddToWishlistBodySchema = Type.Object({
  productId: Type.String({ format: 'uuid', description: 'Product ID to add' }),
});

export type AddToWishlistBody = Static<typeof AddToWishlistBodySchema>;

export const BulkAddToWishlistBodySchema = Type.Object({
  productIds: Type.Array(Type.String({ format: 'uuid' }), {
    minItems: 1,
    maxItems: 50,
    description: 'List of product IDs to add (max 50)',
  }),
});

export type BulkAddToWishlistBody = Static<typeof BulkAddToWishlistBodySchema>;

export const WishlistQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 20 })),
});

export type WishlistQuery = Static<typeof WishlistQuerySchema>;
