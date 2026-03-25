import { bool, cleanEnv, host, port, str } from 'envalid';

export const env = cleanEnv(process.env, {
  // App
  PORT: port({ default: 3000 }),

  // Database
  DB_HOST: host({ default: 'localhost' }),
  DB_PORT: port({ default: 5432 }),
  DB_USER: str({ default: 'postgres' }),
  DB_PASS: str({ default: 'postgres' }),
  DB_NAME: str({ default: 'emart' }),
  DB_SYNC: bool({ default: false }),

  // JWT
  JWT_SECRET: str({ devDefault: 'dev-secret-change-in-production' }),
  JWT_ACCESS_EXPIRES_IN: str({ devDefault: '15m' }),
  JWT_REFRESH_EXPIRES_IN: str({ devDefault: '7d' }),
});
