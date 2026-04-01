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
  NotFoundException,
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
    if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
      return false;
    }
    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    if (leftBuffer.length !== rightBuffer.length) return false;
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private buildQueryString(
    record: Record<string, unknown>,
    keys: string[],
    encodeSpacesAsPlus: boolean,
  ): string {
    return keys
      .map((key) => {
        const rawValue = this.toSignatureString(record[key]);
        const encodedKey = encodeURIComponent(key);
        const encodedValue = encodeURIComponent(rawValue);
        if (encodeSpacesAsPlus) {
          return `${encodedKey.replace(/%20/g, '+')}=${encodedValue.replace(/%20/g, '+')}`;
        }
        return `${encodedKey}=${encodedValue}`;
      })
      .join('&');
  }

  private getSignatureCandidates(req: Request, body?: unknown): string[] {
    const signatures: string[] = [];
    const headerSignature = req.header('x-kashier-signature');
    if (headerSignature) signatures.push(headerSignature);

    if (this.isRecord(body)) {
      const hash = body.hash;
      if (typeof hash === 'string' && hash.trim().length > 0) {
        signatures.push(hash.trim());
      }
    }

    return [...new Set(signatures)];
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
    signatures: string[],
    body: unknown,
    secrets: string[],
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
    const payloadWithPlus = new URLSearchParams();
    for (const key of sortedKeys) {
      payloadWithPlus.set(key, this.toSignatureString(record[key]));
    }

    const payloadStrict = this.buildQueryString(record, sortedKeys, false);
    const payloadPlus = payloadWithPlus.toString();
    const payloadCustomPlus = this.buildQueryString(record, sortedKeys, true);
    const payloadCandidates = [payloadPlus, payloadStrict, payloadCustomPlus];

    for (const secret of secrets) {
      for (const payloadCandidate of payloadCandidates) {
        const expected = createHmac('sha256', secret)
          .update(payloadCandidate)
          .digest('hex');

        if (
          signatures.some((signature) => this.safeEqualHex(signature, expected))
        ) {
          return true;
        }
      }
    }

    return false;
  }

  private verifyWebhookSignature(
    req: Request & { rawBody?: Buffer },
    secrets: string[],
    body?: unknown,
  ) {
    const signatureCandidates = this.getSignatureCandidates(req, body);
    if (signatureCandidates.length === 0) {
      throw new UnauthorizedException('Missing webhook signature');
    }

    if (
      body &&
      this.verifyKashierDataSignature(signatureCandidates, body, secrets)
    ) {
      return;
    }

    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (!rawBody) {
      throw new BadRequestException('Webhook raw body missing');
    }

    for (const secret of secrets) {
      const expected = createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');
      if (
        signatureCandidates.some((signature) =>
          this.safeEqualHex(signature, expected),
        )
      ) {
        return;
      }
    }

    if (body && this.isRecord(body) && this.isRecord(body.data)) {
      throw new UnauthorizedException(
        'Invalid webhook signature. Check KASHIER_WEBHOOK_SECRET value and signing format.',
      );
    }

    {
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
  async handleKashierWebhook(
    @Body() payload: unknown,
    @Req() req: Request & { rawBody?: Buffer },
  ) {
    const config = kashierConfig();
    const secretCandidates = [
      config.webhookSecret,
      config.apiKey,
      config.secretKey,
    ]
      .map((value) => value?.trim())
      .filter((value): value is string => Boolean(value));

    if (secretCandidates.length === 0) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    this.verifyWebhookSignature(req, secretCandidates, payload);

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
      try {
        return await this.paymentsService.updateStatusByExternalId(
          normalizedDto.externalId,
          normalizedDto as UpdatePaymentStatusBody,
        );
      } catch (error) {
        if (!(error instanceof NotFoundException)) {
          throw error;
        }
      }
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
    this.verifyWebhookSignature(req, [webhookSecret]);
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
