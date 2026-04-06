import { bool, cleanEnv, host, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  // App
  PORT: port({ default: 3000 }),
  APP_URL: str({ default: 'http://localhost:3000' }),
  FRONTEND_URL: str({ default: 'http://localhost:4200' }),
  FRONTEND_ALLOWED_ORIGINS: str({ default: 'http://localhost:4200' }),

  // Database
  DB_HOST: host({ default: 'localhost' }),
  DB_PORT: port({ default: 5432 }),
  DB_USER: str({ default: 'postgres' }),
  DB_PASS: str({ default: 'postgres' }),
  DB_NAME: str({ default: 'emart' }),
  DB_SYNC: bool({ default: false }),

  // Auth
  JWT_SECRET: str(),
  JWT_EXPIRES_IN: str({ default: '1d' }),
  JWT_ACCESS_EXPIRES_IN: str({ default: '15m' }),
  JWT_REFRESH_EXPIRES_IN: str({ default: '7d' }),
  EMAIL_VERIFICATION_SECRET: str(),

  // Mail
  MAIL_HOST: host({ default: 'localhost' }),
  MAIL_PORT: port({ default: 1025 }),
  MAIL_SECURE: bool({ default: false }),
  MAIL_USER: str({ default: '' }),
  MAIL_PASS: str({ default: '' }),
  MAIL_FROM: str({ default: 'no-reply@emart.local' }),

  // Google OAuth
  GOOGLE_OAUTH_CLIENT_ID: str(),
  GOOGLE_OAUTH_CLIENT_SECRET: str(),
  GOOGLE_OAUTH_CALLBACK_URL: str(),
  OAUTH_STATE_SECRET: str(),
  OAUTH_EXCHANGE_CODE_TTL_SECONDS: port({ default: 120 }),

  // Payments
  STRIPE_SECRET_KEY: str({ default: '' }),
  KASHIER_URL: str({ default: '' }),
  KASHIER_API_KEY: str({ default: '' }),
  KASHIER_SECRET_KEY: str({ default: '' }),
  KASHIER_MERCHANT_ID: str({ default: '' }),
  KASHIER_WEBHOOK_URL: str({ default: '' }),
  KASHIER_WEBHOOK_SECRET: str({ default: '' }),
  KASHIER_REDIRECT_URL: str({ default: '' }),

  // Media / ImageKit
  IMAGEKIT_PUBLIC_KEY: str({ default: '' }),
  IMAGEKIT_PRIVATE_KEY: str({ default: '' }),
  IMAGEKIT_URL_ENDPOINT: str({ default: '' }),
});
