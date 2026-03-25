import type { JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { env } from './env';

export const jwtConfig = (): JwtModuleOptions => ({
  secret: env.JWT_SECRET,
  signOptions: { expiresIn: env.JWT_ACCESS_EXPIRES_IN as StringValue },
});
