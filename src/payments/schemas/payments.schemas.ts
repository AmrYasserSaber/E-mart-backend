import { Type, Static } from '@sinclair/typebox';

export const PaymentIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Payment id',
});

export const CreatePaymentBodySchema = Type.Object({
  amount: Type.Number({ minimum: 0 }),
  currency: Type.Optional(Type.String({ minLength: 3, maxLength: 3, default: 'EGP' })),
  orderId: Type.Optional(Type.String({ format: 'uuid' })),
});

export type CreatePaymentBody = Static<typeof CreatePaymentBodySchema>;

export const UpdatePaymentStatusBodySchema = Type.Object({
  status: Type.Union([
    Type.Literal('PENDING'),
    Type.Literal('SUCCESS'),
    Type.Literal('FAILED'),
  ]),
  externalId: Type.Optional(Type.String()),
  rawResponse: Type.Optional(Type.Any()),
});

export type UpdatePaymentStatusBody = Static<typeof UpdatePaymentStatusBodySchema>;
