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
import { CategoriesModule } from '../src/categories/categories.module';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { Review } from '../src/reviews/entities/review.entity';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Role } from '../src/common/enums/role.enum';

function assertSafeTestDbName(dbName: string | undefined): asserts dbName {
  if (!dbName) {
    throw new Error(
      'Refusing to run e2e tests with dropSchema: true. Set TEST_DB_NAME to a test database (must include "test" or end with "_test").',
    );
  }

  const normalized = dbName.toLowerCase();
  const isClearlyTest =
    normalized.includes('test') || normalized.endsWith('_test');
  if (!isClearlyTest) {
    throw new Error(
      `Refusing to run e2e tests with dropSchema: true on database "${dbName}". TEST_DB_NAME must include "test" or end with "_test".`,
    );
  }
}

describe('Categories (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let refreshTokenRepository: Repository<RefreshToken>;
  let categoryRepository: Repository<Category>;
  let productRepository: Repository<Product>;
  let reviewRepository: Repository<Review>;

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
          entities: [User, RefreshToken, Category, Product, Review],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        CategoriesModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepository = moduleFixture.get(getRepositoryToken(RefreshToken));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    const dataSource = moduleFixture.get(DataSource);
    productRepository = dataSource.getRepository(Product);
    reviewRepository = dataSource.getRepository(Review);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await reviewRepository.createQueryBuilder().delete().execute();
    await productRepository.createQueryBuilder().delete().execute();
    await categoryRepository.createQueryBuilder().delete().execute();
    await refreshTokenRepository.createQueryBuilder().delete().execute();
    await userRepository.createQueryBuilder().delete().execute();
  });

  async function createUserAndToken(
    email: string,
    role: Role,
  ): Promise<{ token: string }> {
    const password = 'password123';
    const passwordHash = await bcrypt.hash(password, 12);

    await userRepository.save({
      firstName: role === Role.ADMIN ? 'Admin' : 'User',
      lastName: 'Tester',
      email,
      passwordHash,
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

    return { token: loginResponse.body.accessToken as string };
  }

  it('GET /categories should return list', async () => {
    await categoryRepository.save([
      { name: 'Electronics', slug: 'electronics', parentId: null },
      { name: 'Sneakers', slug: 'sneakers', parentId: null },
    ]);

    const response = await request(app.getHttpServer())
      .get('/categories')
      .expect(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);
  });

  it('POST /categories should create category for admin', async () => {
    const { token } = await createUserAndToken('admin@test.local', Role.ADMIN);

    const response = await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(201);

    expect(response.body.name).toBe('Headphones');
    expect(response.body.slug).toBe('headphones');
  });

  it('POST /categories should return 401 without token', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(401);
  });

  it('POST /categories should return 403 for non-admin', async () => {
    const { token } = await createUserAndToken('user@test.local', Role.USER);
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(403);
  });

  it('POST /categories should return 409 for duplicate slug', async () => {
    const { token } = await createUserAndToken('admin@test.local', Role.ADMIN);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Headphones', slug: 'headphones' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Another', slug: 'headphones' })
      .expect(409);
  });

  it('PATCH /categories/:id should update for admin', async () => {
    const { token } = await createUserAndToken('admin@test.local', Role.ADMIN);
    const created = await categoryRepository.save({
      name: 'Headphones',
      slug: 'headphones',
      parentId: null,
    });

    const response = await request(app.getHttpServer())
      .patch(`/categories/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Headphones Pro' })
      .expect(200);

    expect(response.body.name).toBe('Headphones Pro');
  });

  it('PATCH /categories/:id should return 400 for invalid uuid', async () => {
    const { token } = await createUserAndToken('admin@test.local', Role.ADMIN);
    await request(app.getHttpServer())
      .patch('/categories/not-a-uuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'X' })
      .expect(400);
  });

  it('DELETE /categories/:id should delete for admin', async () => {
    const { token } = await createUserAndToken('admin@test.local', Role.ADMIN);
    const created = await categoryRepository.save({
      name: 'Headphones',
      slug: 'headphones',
      parentId: null,
    });

    await request(app.getHttpServer())
      .delete(`/categories/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const found = await categoryRepository.findOne({ where: { id: created.id } });
    expect(found).toBeNull();
  });
});
