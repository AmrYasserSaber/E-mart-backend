import { Type, Static } from '@sinclair/typebox';

export const PaymentIdParamSchema = Type.String({
  format: 'uuid',
  description: 'Payment id',
});

export const PaymentMethodSchema = Type.Union([
  Type.Literal('KASHIER'),
  Type.Literal('CASH_ON_DELIVERY'),
]);

export const CreatePaymentBodySchema = Type.Object({
  amount: Type.Optional(Type.Number({ minimum: 0 })),
  currency: Type.Optional(
    Type.String({ minLength: 3, maxLength: 3, default: 'EGP' }),
  ),
  orderId: Type.String({ format: 'uuid' }),
  paymentMethod: Type.Optional(PaymentMethodSchema),
});

export type CreatePaymentBody = Static<typeof CreatePaymentBodySchema>;

export const CreatePaymentResponseSchema = Type.Object({
  message: Type.String({ minLength: 1 }),
  paymentUrl: Type.Union([Type.String({ minLength: 1 }), Type.Null()]),
});

export type CreatePaymentResponse = Static<typeof CreatePaymentResponseSchema>;

export const UpdatePaymentStatusBodySchema = Type.Object({
  status: Type.Union([
    Type.Literal('PENDING'),
    Type.Literal('SUCCESS'),
    Type.Literal('FAILED'),
  ]),
  externalId: Type.Optional(Type.String()),
  rawResponse: Type.Optional(Type.Any()),
});

export type UpdatePaymentStatusBody = Static<
  typeof UpdatePaymentStatusBodySchema
>;
