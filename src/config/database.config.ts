import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { env } from './env';

export const databaseConfig = (): TypeOrmModuleOptions => ({
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  synchronize: env.DB_SYNC,
  autoLoadEntities: true,
});
