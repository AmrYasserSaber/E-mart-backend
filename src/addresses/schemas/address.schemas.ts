import { Type, Static } from '@sinclair/typebox';

export const AddressIdParamSchema = Type.String({ format: 'uuid' });

export const CreateAddressBodySchema = Type.Object({
  label: Type.Optional(Type.String({ maxLength: 50 })),
  firstName: Type.String({ minLength: 1, maxLength: 100 }),
  lastName: Type.String({ minLength: 1, maxLength: 100 }),
  phone: Type.Optional(Type.String({ maxLength: 30 })),
  street: Type.String({ minLength: 1, maxLength: 200 }),
  city: Type.String({ minLength: 1, maxLength: 100 }),

  isPrimary: Type.Optional(Type.Boolean()),
});

export type CreateAddressBody = Static<typeof CreateAddressBodySchema>;

export const UpdateAddressBodySchema = Type.Object({
  label: Type.Optional(Type.String({ maxLength: 50 })),
  firstName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  lastName: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
  phone: Type.Optional(Type.String({ maxLength: 30 })),
  street: Type.Optional(Type.String({ minLength: 1, maxLength: 200 })),
  city: Type.Optional(Type.String({ minLength: 1, maxLength: 100 })),
});

export type UpdateAddressBody = Static<typeof UpdateAddressBodySchema>;

export const AddressPublicSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  label: Type.Union([Type.String(), Type.Null()]),
  firstName: Type.String(),
  lastName: Type.String(),
  phone: Type.Union([Type.String(), Type.Null()]),
  street: Type.String(),
  city: Type.String(),
  isPrimary: Type.Boolean(),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export const AddressListResponseSchema = Type.Object({
  data: Type.Array(AddressPublicSchema),
});

export type AddressListResponse = Static<typeof AddressListResponseSchema>;
