import { Injectable, BadRequestException } from '@nestjs/common';
import { kashierConfig } from '../../config/kashier.config';

interface KashierCreatePaymentResponse {
  sessionUrl?: string;
  status?: string;
  _id?: string;
  data?: {
    sessionUrl?: string;
    redirectUrl?: string;
    merchantOrderId?: string;
    _id?: string;
  };
  redirectUrl?: string;
  merchantOrderId?: string;
}

@Injectable()
export class KashierProvider {
  private readonly config = kashierConfig();

  private isValidAbsoluteUrl(value: string | undefined): value is string {
    if (!value) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  private resolveMerchantRedirect(): string {
    const candidates = [this.config.redirectUrl, this.config.webhookUrl];

    for (const candidate of candidates) {
      if (!this.isValidAbsoluteUrl(candidate)) continue;
      const hostname = new URL(candidate).hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1') continue;
      return candidate;
    }

    throw new BadRequestException(
      'Kashier redirect URL is invalid. Set KASHIER_REDIRECT_URL to a public https URL.',
    );
  }

  async createPaymentLink(params: {
    orderId: string;
    amount: number;
    currency: string;
    customerEmail: string;
  }): Promise<{ redirectUrl: string; externalId?: string; raw: any }> {
    if (
      !this.config.baseUrl ||
      !this.config.apiKey ||
      !this.config.secretKey ||
      !this.config.merchantId
    ) {
      throw new BadRequestException('Kashier configuration is missing');
    }

    const amount = Number(params.amount).toFixed(2);
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    const redirect = new URL(this.resolveMerchantRedirect());
    redirect.searchParams.set('orderId', params.orderId);
    const merchantRedirect = redirect.toString();

    const payload = {
      amount,
      currency: params.currency,
      order: params.orderId,
      merchantId: this.config.merchantId,
      paymentType: 'credit',
      type: 'one-time',
      merchantRedirect,
      serverWebhook: this.config.webhookUrl || undefined,
      customer: {
        email: params.customerEmail,
        reference: params.orderId,
      },
    };

    const response = await fetch(`${baseUrl}/v3/payment/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.config.secretKey,
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new BadRequestException(
        `Kashier request failed: ${response.status} ${text}`,
      );
    }

    const data = (await response.json()) as KashierCreatePaymentResponse;
    const redirectUrl =
      data.sessionUrl ||
      data.redirectUrl ||
      data.data?.sessionUrl ||
      data.data?.redirectUrl;

    if (!redirectUrl) {
      throw new BadRequestException('Kashier response missing payment URL');
    }

    return {
      redirectUrl,
      externalId:
        data._id ||
        data.data?._id ||
        data.merchantOrderId ||
        data.data?.merchantOrderId,
      raw: data,
    };
  }
}
