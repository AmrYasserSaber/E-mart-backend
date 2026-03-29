import { Type, Static } from '@sinclair/typebox';

export const CategoryIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Category id',
});

export const CreateCategoryBodySchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 120 }),
  slug: Type.String({ minLength: 1, maxLength: 140 }),
  parentId: Type.Optional(
    Type.Union([Type.String({ format: 'uuid' }), Type.Null()]),
  ),
});

export type CreateCategoryBody = Static<typeof CreateCategoryBodySchema>;

export const UpdateCategoryBodySchema = Type.Partial(CreateCategoryBodySchema);

export type UpdateCategoryBody = Static<typeof UpdateCategoryBodySchema>;
