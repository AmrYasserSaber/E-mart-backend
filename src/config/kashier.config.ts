import { env } from './env';

export const kashierConfig = () => {
  return {
    baseUrl: env.KASHIER_URL,
    apiKey: env.KASHIER_API_KEY,
    secretKey: env.KASHIER_SECRET_KEY,
    merchantId: env.KASHIER_MERCHANT_ID,
    webhookUrl: env.KASHIER_WEBHOOK_URL,
    webhookSecret: env.KASHIER_WEBHOOK_SECRET,
    redirectUrl: env.KASHIER_REDIRECT_URL,
  };
};
