import { Type, Static } from '@sinclair/typebox';

export const ReviewProductIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Product id (route)',
});

export const ReviewIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Review id',
});

export const ReviewsListQuerySchema = Type.Object({
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1 })),
});

export type ReviewsListQuery = Static<typeof ReviewsListQuerySchema>;

export const CreateReviewBodySchema = Type.Object({
  productId: Type.Optional(Type.String({ format: 'uuid' })),
  userId: Type.Optional(Type.String({ format: 'uuid' })),
  rating: Type.Integer({ minimum: 1, maximum: 5 }),
  comment: Type.String({ minLength: 1 }),
});

export type CreateReviewBody = Static<typeof CreateReviewBodySchema>;

export const UpdateReviewBodySchema = Type.Partial(CreateReviewBodySchema);

export type UpdateReviewBody = Static<typeof UpdateReviewBodySchema>;
