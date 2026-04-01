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

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private safeEqualHex(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private toSignatureString(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'bigint'
    ) {
      return `${value}`;
    }
    if (this.isRecord(value) || Array.isArray(value)) {
      return JSON.stringify(value);
    }
    return '';
  }

  private verifyKashierDataSignature(
    signature: string,
    body: unknown,
    secret: string,
  ): boolean {
    const bodyRecord = this.isRecord(body) ? body : null;
    if (!bodyRecord) return false;

    const data = bodyRecord.data;
    if (!this.isRecord(data)) return false;

    const record = data;
    const signatureKeysRaw = record.signatureKeys;
    const signatureKeys = Array.isArray(signatureKeysRaw)
      ? signatureKeysRaw.filter((k): k is string => typeof k === 'string')
      : [];

    if (signatureKeys.length === 0) return false;

    const sortedKeys = [...signatureKeys].sort((a, b) => a.localeCompare(b));
    const payload = new URLSearchParams();
    for (const key of sortedKeys) {
      payload.set(key, this.toSignatureString(record[key]));
    }

    const expected = createHmac('sha256', secret)
      .update(payload.toString())
      .digest('hex');

    return this.safeEqualHex(signature, expected);
  }

  private verifyWebhookSignature(
    req: Request & { rawBody?: Buffer },
    secret: string,
    body?: unknown,
  ) {
    const signature = req.header('x-kashier-signature');
    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (body && this.verifyKashierDataSignature(signature, body, secret)) {
      return;
    }

    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (!rawBody) {
      throw new BadRequestException('Webhook raw body missing');
    }

    if (!/^[a-f0-9]+$/i.test(signature)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');

    if (!this.safeEqualHex(signature, expected)) {
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
  handleKashierWebhook(
    @Body() payload: unknown,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const config = kashierConfig();
    const webhookSecret =
      config.webhookSecret || config.apiKey || config.secretKey;
    if (!webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    this.verifyWebhookSignature(req, webhookSecret, payload);

    const payloadRecord: Record<string, unknown> = this.isRecord(payload)
      ? payload
      : {};
    const bodyData: Record<string, unknown> = this.isRecord(payloadRecord.data)
      ? payloadRecord.data
      : {};

    const normalize = (value: unknown): string | undefined => {
      if (typeof value !== 'string') return undefined;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizeStatus = (
      value: unknown,
    ): UpdatePaymentStatusBody['status'] => {
      const normalized = normalize(value)?.toUpperCase();
      if (normalized === 'SUCCESS' || normalized === 'PAID') return 'SUCCESS';
      if (normalized === 'FAILED') return 'FAILED';
      return 'PENDING';
    };

    const normalizedDto = {
      status: normalizeStatus(bodyData.status ?? payloadRecord.status),
      externalId:
        normalize(bodyData.transactionId) ||
        normalize(bodyData.kashierOrderId) ||
        normalize(payloadRecord.transactionId),
      transactionId:
        normalize(bodyData.transactionId) ||
        normalize(payloadRecord.transactionId),
      orderId:
        normalize(bodyData.merchantOrderId) || normalize(bodyData.orderId),
      rawResponse: payloadRecord,
    } satisfies UpdatePaymentStatusBody;

    if (normalizedDto.externalId) {
      return this.paymentsService.updateStatusByExternalId(
        normalizedDto.externalId,
        normalizedDto as UpdatePaymentStatusBody,
      );
    }

    const orderId =
      normalize(bodyData.merchantOrderId) || normalize(bodyData.orderId);
    if (orderId) {
      return this.paymentsService.updateStatusByOrderId(orderId, normalizedDto);
    }

    throw new BadRequestException(
      'Missing externalId or orderId in webhook payload',
    );
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
    @Param('id') id: string,
    @Body() updateDto: UpdatePaymentStatusBody,
    @Req() req: Request & { rawBody?: Buffer },
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
  async listCards(
    @CurrentUser() currentUser: UserPublic,
  ): Promise<CardsListResponse> {
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
