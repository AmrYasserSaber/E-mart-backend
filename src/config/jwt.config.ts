import { env } from './env';

export const jwtConfig = () => ({
  secret: env.JWT_SECRET,
  signOptions: {
    expiresIn: env.JWT_EXPIRES_IN as unknown as number,
  },
});
