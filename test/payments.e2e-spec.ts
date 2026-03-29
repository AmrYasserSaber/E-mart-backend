import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureNestJsTypebox } from 'nestjs-typebox';

import { AuthModule } from '../src/auth/auth.module';
import { PaymentsModule } from '../src/payments/payments.module';
import { CategoriesModule } from '../src/categories/categories.module';
import { ProductsModule } from '../src/products/products.module';
import { CartModule } from '../src/cart/cart.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { Review } from '../src/reviews/entities/review.entity';
import { Cart } from '../src/cart/entities/cart.entity';
import { CartItem } from '../src/cart/entities/cart-item.entity';
import { Payment, PaymentStatus } from '../src/payments/entities/payment.entity';
import { Role } from '../src/common/enums/role.enum';

function assertSafeTestDbName(dbName: string | undefined): asserts dbName {
  if (!dbName) {
    throw new Error('TEST_DB_NAME must include "test" or end with "_test".');
  }
}

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let paymentRepository: Repository<Payment>;

  beforeAll(async () => {
    configureNestJsTypebox({ patchSwagger: false, setFormats: true });
    const testDbName = process.env.TEST_DB_NAME;
    assertSafeTestDbName(testDbName);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TEST_DB_HOST || 'localhost',
          port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
          username: process.env.TEST_DB_USER || 'postgres',
          password: process.env.TEST_DB_PASS || 'postgres',
          database: testDbName,
          entities: [User, RefreshToken, Category, Product, Review, Cart, CartItem, Payment],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        CategoriesModule,
        ProductsModule,
        CartModule,
        PaymentsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepository = moduleFixture.get(getRepositoryToken(RefreshToken));
    paymentRepository = moduleFixture.get(getRepositoryToken(Payment));
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await paymentRepository.createQueryBuilder().delete().execute();
    await refreshTokenRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
  });

  async function createUserAndToken(email: string, role: Role) {
    const password = 'password123';
    const user = await userRepository.save({
      firstName: role.toUpperCase(),
      lastName: 'Tester',
      email,
      passwordHash: await bcrypt.hash(password, 12),
      role,
      emailVerifiedAt: new Date(),
      active: true,
      emailVerificationCodeHash: null,
      emailVerificationExpiresAt: null,
    });
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return { user, token: loginResponse.body.accessToken as string };
  }

  it('should create a payment record', async () => {
    const { token } = await createUserAndToken('user-create@test.local', Role.USER);
    const res = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 150 });

    if (res.status !== 201) {
      // eslint-disable-next-line no-console
      console.log('Error response body:', res.body);
    }
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.amount).toBe(150);
    expect(res.body.status).toBe(PaymentStatus.PENDING);
    expect(res.body.gateway).toBe('kashier');
  });

  it('should handle webhook updates', async () => {
    const { user } = await createUserAndToken('user-webhook@test.local', Role.USER);
    
    // Create initial payment
    const payment = await paymentRepository.save({
      userId: user.id,
      amount: 500,
      currency: 'EGP',
      status: PaymentStatus.PENDING,
      gateway: 'kashier'
    });

    // Simulate webhook
    const res = await request(app.getHttpServer())
      .post(`/payments/${payment.id}/webhook`)
      .send({
        status: 'SUCCESS',
        externalId: 'ext_123',
        rawResponse: { success: true }
      })
      .expect(201);

    expect(res.body.status).toBe(PaymentStatus.SUCCESS);
    expect(res.body.externalId).toBe('ext_123');
  });
});
