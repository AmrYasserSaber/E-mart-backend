import { bool, cleanEnv, host, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  // App
  PORT: port({ default: 3000 }),
  APP_URL: str({ default: 'http://localhost:3000' }),

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

  // Payments
  STRIPE_SECRET_KEY: str({ default: '' }),
});
