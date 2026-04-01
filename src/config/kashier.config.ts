import { env } from './env';

export interface KashierConfig {
  baseUrl: string;
  apiKey: string;
  secretKey: string;
  merchantId: string;
  webhookUrl: string;
  webhookSecret: string;
  redirectUrl: string;
}

export const kashierConfig = (): KashierConfig => {
  return {
    baseUrl: String(env.KASHIER_URL),
    apiKey: String(env.KASHIER_API_KEY),
    secretKey: String(env.KASHIER_SECRET_KEY),
    merchantId: String(env.KASHIER_MERCHANT_ID),
    webhookUrl: String(env.KASHIER_WEBHOOK_URL),
    webhookSecret: String(env.KASHIER_WEBHOOK_SECRET),
    redirectUrl: String(env.KASHIER_REDIRECT_URL),
  };
};
