import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Req,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';
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
import { kashierConfig } from '../config/kashier.config';

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

  private verifyWebhookSignature(
    req: Request & { rawBody?: Buffer },
    secret: string,
  ) {
    const signature = req.header('x-kashier-signature');
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (!rawBody) {
      throw new BadRequestException('Webhook raw body missing');
    }

    const expected = createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

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
    return this.paymentsService.create(
      currentUser.id,
      createDto,
      currentUser.email,
    );
  }

  // A webhook endpoint typically doesn't use standard User-auth but rather expects a webhook signature header.
  @Post('webhook')
  @Validate({
    request: [
      {
        type: 'body',
        schema: UpdatePaymentStatusBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  handleKashierWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Body() updateDto: UpdatePaymentStatusBody,
  ) {
    const config = kashierConfig();
    const webhookSecret = config.webhookSecret || config.secretKey;
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    this.verifyWebhookSignature(req, webhookSecret);

    const normalizedDto: UpdatePaymentStatusBody = {
      ...updateDto,
      externalId: updateDto.externalId || updateDto.transactionId,
      status: updateDto.status,
    };

    if (normalizedDto.externalId) {
      return this.paymentsService.updateStatusByExternalId(
        normalizedDto.externalId,
        normalizedDto,
      );
    }

    if (updateDto.orderId) {
      return this.paymentsService.updateStatusByOrderId(
        updateDto.orderId,
        normalizedDto,
      );
    }

    throw new BadRequestException('Missing externalId or orderId in webhook payload');
  }

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
  handleWebhook(
    @Req() req: Request & { rawBody?: Buffer },
    @Param('id') id: string,
    @Body() updateDto: UpdatePaymentStatusBody,
  ) {
    const config = kashierConfig();
    const webhookSecret = config.webhookSecret || config.secretKey;
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    this.verifyWebhookSignature(req, webhookSecret);
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
