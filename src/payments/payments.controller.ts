import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
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
import {
  SaveCardBodySchema,
  CardsListResponseSchema,
  CardResponseSchema,
  type SaveCardBody,
  type CardsListResponse,
  type CardResponse,
} from './schemas/card.schemas';
import { UserCard } from './entities/user-card.entity';

function mapCardToResponse(card: UserCard): CardResponse {
  return {
    id: card.id,
    userId: card.userId,
    brand: card.brand,
    last4: card.last4,
    expMonth: card.expMonth,
    expYear: card.expYear,
    cardholderName: card.cardholderName,
    isDefault: card.isDefault,
    createdAt: card.createdAt.toISOString(),
  };
}

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

  @Get('cards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List saved cards' })
  @Validate({
    response: { schema: CardsListResponseSchema, stripUnknownProps: true },
  })
  async listCards(@CurrentUser() currentUser: UserPublic): Promise<CardsListResponse> {
    const cards = await this.paymentsService.listCards(currentUser.id);
    return cards.map(mapCardToResponse);
  }

  @Post('cards')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save new card' })
  @Validate({
    request: [
      {
        type: 'body',
        schema: SaveCardBodySchema,
        stripUnknownProps: true,
      },
    ],
    response: { schema: CardResponseSchema, stripUnknownProps: true },
  })
  async saveCard(
    @Body() dto: SaveCardBody,
    @CurrentUser() currentUser: UserPublic,
  ): Promise<CardResponse> {
    const card = await this.paymentsService.saveCard(currentUser.id, dto);
    return mapCardToResponse(card);
  }

  @Post('cards/:id/delete') // Using POST for delete to simplify for this project, or can use @Delete
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete saved card' })
  deleteCard(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.paymentsService.deleteCard(currentUser.id, id);
  }
}
