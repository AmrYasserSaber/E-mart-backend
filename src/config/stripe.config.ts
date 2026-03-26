import { env } from './env';

export const stripeConfig = () => ({
  apiKey: env.STRIPE_SECRET_KEY,
});
