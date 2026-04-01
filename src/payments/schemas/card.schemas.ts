import { Type, Static } from '@sinclair/typebox';

export const SaveCardBodySchema = Type.Object({
  cardholderName: Type.String({ minLength: 2, maxLength: 50 }),
  brand: Type.String({ minLength: 1, maxLength: 20 }),
  last4: Type.String({ minLength: 4, maxLength: 4, pattern: '^[0-9]+$' }),
  expiryMonth: Type.Integer({ minimum: 1, maximum: 12 }),
  expiryYear: Type.Integer({ minimum: new Date().getFullYear(), maximum: 2040 }),
  paymentToken: Type.Optional(Type.String({ minLength: 1 })),
});

export type SaveCardBody = Static<typeof SaveCardBodySchema>;

export const CardResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  userId: Type.String({ format: 'uuid' }),
  brand: Type.String(),
  last4: Type.String(),
  expMonth: Type.Integer(),
  expYear: Type.Integer(),
  cardholderName: Type.String(),
  isDefault: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
});

export type CardResponse = Static<typeof CardResponseSchema>;

export const CardsListResponseSchema = Type.Array(CardResponseSchema);
export type CardsListResponse = Static<typeof CardsListResponseSchema>;
