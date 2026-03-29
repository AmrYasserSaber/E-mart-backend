import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import {
  CreatePaymentBodySchema,
  CreatePaymentResponseSchema,
  PaymentIdParamSchema,
  UpdatePaymentStatusBodySchema,
  type CreatePaymentBody,
  type CreatePaymentResponse,
  type UpdatePaymentStatusBody,
} from './schemas/payments.schemas';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create payment session' })
  @ApiBody({
    description: 'Create payment request',
    examples: {
      kashier: {
        summary: 'Kashier payment',
        value: {
          orderId: 'ORDER_UUID',
          paymentMethod: 'KASHIER',
        },
      },
    },
  })
  @ApiCreatedResponse({ description: 'Payment session created' })
  @Validate({
    request: [
      {
        type: 'body',
        schema: CreatePaymentBodySchema,
        stripUnknownProps: true,
      },
    ],
    response: { schema: CreatePaymentResponseSchema, stripUnknownProps: true },
  })
  create(
    createDto: CreatePaymentBody,
    @CurrentUser() currentUser: UserPublic,
  ): Promise<CreatePaymentResponse> {
    return this.paymentsService.create(currentUser.id, createDto);
  }

  // A webhook endpoint typically doesn't use standard User-auth but rather expects a webhook signature header.
  @Post(':id/webhook')
  @Validate({
    request: [
      { name: 'id', type: 'param', schema: PaymentIdParamSchema },
      {
        type: 'body',
        schema: UpdatePaymentStatusBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  handleWebhook(@Param('id') id: string, updateDto: UpdatePaymentStatusBody) {
    return this.paymentsService.updateStatus(id, updateDto);
  }
}
