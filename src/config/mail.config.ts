import { env } from './env';

export const mailConfig = () => ({
  host: env.MAIL_HOST,
  port: env.MAIL_PORT,
  secure: env.MAIL_SECURE,
  user: env.MAIL_USER,
  pass: env.MAIL_PASS,
  from: env.MAIL_FROM,
});
