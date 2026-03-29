import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureNestJsTypebox } from 'nestjs-typebox';
import { AuthModule } from '../src/auth/auth.module';
import { ReviewsModule } from '../src/reviews/reviews.module';
import { ProductsModule } from '../src/products/products.module';
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
  if (!(normalized.includes('test') || normalized.endsWith('_test'))) {
    throw new Error(
      `Refusing to run e2e tests with dropSchema: true on database "${dbName}". TEST_DB_NAME must include "test" or end with "_test".`,
    );
  }
}

describe('Reviews (e2e)', () => {
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
        ProductsModule,
        ReviewsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepository = moduleFixture.get(getRepositoryToken(RefreshToken));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    productRepository = moduleFixture.get(getRepositoryToken(Product));
    reviewRepository = moduleFixture.get(getRepositoryToken(Review));
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

  async function createProductForReviews(sellerId: string) {
    const category = await categoryRepository.save({
      name: 'Electronics',
      slug: 'electronics',
      parentId: null,
    });
    return productRepository.save({
      sellerId,
      categoryId: category.id,
      title: 'Headphones X',
      description: 'Wireless headphones',
      price: 100,
      stock: 10,
      images: ['img-a'],
      ratingAvg: 0,
      ratingCount: 0,
    });
  }

  it('POST /reviews/:productId should create review for authenticated user', async () => {
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);
    const product = await createProductForReviews(seller.id);
    const { token: userToken } = await createUserAndToken('user@test.local', Role.USER);

    const response = await request(app.getHttpServer())
      .post(`/reviews/${product.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ rating: 5, comment: 'Great product' })
      .expect(201);

    expect(response.body.productId).toBe(product.id);
    expect(response.body.rating).toBe(5);
  });

  it('GET /reviews/:productId should return paginated reviews', async () => {
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);
    const product = await createProductForReviews(seller.id);
    const { user: userA } = await createUserAndToken('a@test.local', Role.USER);
    const { user: userB } = await createUserAndToken('b@test.local', Role.USER);

    await reviewRepository.save([
      { productId: product.id, userId: userA.id, rating: 4, comment: 'Nice' },
      { productId: product.id, userId: userB.id, rating: 5, comment: 'Excellent' },
    ]);

    const response = await request(app.getHttpServer())
      .get(`/reviews/${product.id}`)
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body.total).toBe(2);
    expect(response.body.page).toBe(1);
  });

  it('GET /reviews/item/:reviewId should return review and 404 when missing', async () => {
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);
    const product = await createProductForReviews(seller.id);
    const { user } = await createUserAndToken('user@test.local', Role.USER);
    const review = await reviewRepository.save({
      productId: product.id,
      userId: user.id,
      rating: 4,
      comment: 'Nice',
    });

    await request(app.getHttpServer()).get(`/reviews/item/${review.id}`).expect(200);
    await request(app.getHttpServer())
      .get('/reviews/item/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('PATCH /reviews/:reviewId should allow owner and block other user', async () => {
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);
    const product = await createProductForReviews(seller.id);
    const { user: owner, token: ownerToken } = await createUserAndToken(
      'owner@test.local',
      Role.USER,
    );
    const { token: otherToken } = await createUserAndToken('other@test.local', Role.USER);
    const review = await reviewRepository.save({
      productId: product.id,
      userId: owner.id,
      rating: 3,
      comment: 'ok',
    });

    await request(app.getHttpServer())
      .patch(`/reviews/${review.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comment: 'updated' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/reviews/${review.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ comment: 'hack' })
      .expect(403);
  });

  it('DELETE /reviews/:reviewId should allow owner/admin and block unrelated user', async () => {
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);
    const product = await createProductForReviews(seller.id);
    const { user: owner, token: ownerToken } = await createUserAndToken(
      'owner@test.local',
      Role.USER,
    );
    const { token: otherToken } = await createUserAndToken('other@test.local', Role.USER);
    const { token: adminToken } = await createUserAndToken('admin@test.local', Role.ADMIN);

    const reviewA = await reviewRepository.save({
      productId: product.id,
      userId: owner.id,
      rating: 5,
      comment: 'mine',
    });
    const reviewB = await reviewRepository.save({
      productId: product.id,
      userId: owner.id,
      rating: 4,
      comment: 'admin-delete',
    });

    await request(app.getHttpServer())
      .delete(`/reviews/${reviewA.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/reviews/${reviewA.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/reviews/${reviewB.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });
});
