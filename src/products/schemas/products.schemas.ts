import { Type, Static } from '@sinclair/typebox';

export const ProductIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Product id',
});

export const CreateProductBodySchema = Type.Object({
  title: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  price: Type.Number({ minimum: 0, multipleOf: 0.01 }),
  stock: Type.Integer({ minimum: 0 }),
  categoryId: Type.String({ format: 'uuid' }),
  sellerId: Type.Optional(Type.String({ format: 'uuid' })),
  images: Type.Array(Type.String(), { maxItems: 10 }),
  ratingAvg: Type.Optional(
    Type.Number({ minimum: 0, maximum: 5, multipleOf: 0.01 }),
  ),
  ratingCount: Type.Optional(Type.Integer({ minimum: 0 })),
});

export type CreateProductBody = Static<typeof CreateProductBodySchema>;

export const UpdateProductBodySchema = Type.Partial(CreateProductBodySchema);

export type UpdateProductBody = Static<typeof UpdateProductBodySchema>;

export const ProductFilterQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
  categoryId: Type.Optional(Type.String({ format: 'uuid' })),
  minPrice: Type.Optional(Type.Number({ minimum: 0 })),
  maxPrice: Type.Optional(Type.Number({ minimum: 0 })),
  search: Type.Optional(Type.String()),
  sort: Type.Optional(
    Type.Union([
      Type.Literal('price_asc'),
      Type.Literal('price_desc'),
      Type.Literal('newest'),
    ]),
  ),
});

export type ProductFilterQuery = Static<typeof ProductFilterQuerySchema>;
