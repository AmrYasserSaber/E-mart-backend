import { Static, Type } from '@sinclair/typebox';
import { SellerStatus } from '../entities/seller.entity';

export const UuidSchema = Type.String({ format: 'uuid' });

export const SellerStatusSchema = Type.Enum(SellerStatus, {
  description: 'Seller application status',
});

export const RegisterSellerBodySchema = Type.Object({
  storeName: Type.String({
    minLength: 2,
    maxLength: 150,
    description: 'Store display name',
  }),
  description: Type.String({
    minLength: 5,
    maxLength: 2000,
    description: 'Seller profile description',
  }),
});

export type RegisterSellerBody = Static<typeof RegisterSellerBodySchema>;

export const SellerRegisterResponseSchema = Type.Object({
  id: UuidSchema,
  userId: UuidSchema,
  storeName: Type.String(),
  description: Type.String(),
  status: SellerStatusSchema,
  createdAt: Type.String({ format: 'date-time' }),
});

export type SellerRegisterResponse = Static<
  typeof SellerRegisterResponseSchema
>;

export const PublicProductItemSchema = Type.Object({
  id: UuidSchema,
  title: Type.String({ minLength: 1, maxLength: 255 }),
  price: Type.Number({ minimum: 0 }),
});

export const SellerPublicProfileSchema = Type.Object({
  id: UuidSchema,
  storeName: Type.String(),
  description: Type.String(),
  rating: Type.Number({ minimum: 0 }),
  totalProducts: Type.Integer({ minimum: 0 }),
  products: Type.Array(PublicProductItemSchema),
});

export type SellerPublicProfile = Static<typeof SellerPublicProfileSchema>;

export const SellerOwnProductSchema = Type.Object({
  id: UuidSchema,
  sellerId: UuidSchema,
  categoryId: UuidSchema,
  title: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.String({ minLength: 1 }),
  price: Type.Number({ minimum: 0 }),
  stock: Type.Integer({ minimum: 0 }),
  images: Type.Array(Type.String()),
  ratingAvg: Type.Number({ minimum: 0 }),
  ratingCount: Type.Integer({ minimum: 0 }),
  ordersCount: Type.Integer({ minimum: 0 }),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
  category: Type.Optional(
    Type.Object({
      id: UuidSchema,
      name: Type.String({ minLength: 1 }),
      slug: Type.String({ minLength: 1 }),
    }),
  ),
});

export const SellerOwnProductsResponseSchema = Type.Object({
  data: Type.Array(SellerOwnProductSchema),
  total: Type.Integer({ minimum: 0 }),
  page: Type.Integer({ minimum: 1 }),
});

export type SellerOwnProductsResponse = Static<
  typeof SellerOwnProductsResponseSchema
>;
