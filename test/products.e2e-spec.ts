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

describe('Products (e2e)', () => {
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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    refreshTokenRepository = moduleFixture.get(getRepositoryToken(RefreshToken));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    productRepository = moduleFixture.get(getRepositoryToken(Product));
    const dataSource = moduleFixture.get(DataSource);
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

  async function createCategory() {
    return categoryRepository.save({
      name: 'Electronics',
      slug: 'electronics',
      parentId: null,
    });
  }

  it('GET /products should list and filter products', async () => {
    const categoryA = await createCategory();
    const categoryB = await categoryRepository.save({
      name: 'Fashion',
      slug: 'fashion',
      parentId: null,
    });
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);

    await productRepository.save([
      {
        sellerId: seller.id,
        categoryId: categoryA.id,
        title: 'Headphones X',
        description: 'Wireless headphones',
        price: 100,
        stock: 10,
        images: ['img-a'],
        ratingAvg: 4.5,
        ratingCount: 2,
      },
      {
        sellerId: seller.id,
        categoryId: categoryB.id,
        title: 'Sneakers Y',
        description: 'Sport sneakers',
        price: 50,
        stock: 8,
        images: ['img-b'],
        ratingAvg: 4.0,
        ratingCount: 1,
      },
    ]);

    const response = await request(app.getHttpServer())
      .get('/products')
      .query({ categoryId: categoryA.id, minPrice: 90, search: 'head' })
      .expect(200);

    expect(response.body.total).toBe(1);
    expect(response.body.data[0].title).toBe('Headphones X');
  });

  it('GET /products/:id should return product and 404 for missing', async () => {
    const category = await createCategory();
    const { user: seller } = await createUserAndToken('seller@test.local', Role.SELLER);
    const product = await productRepository.save({
      sellerId: seller.id,
      categoryId: category.id,
      title: 'Headphones X',
      description: 'Wireless headphones',
      price: 100,
      stock: 10,
      images: ['img-a'],
      ratingAvg: 4.5,
      ratingCount: 2,
    });

    await request(app.getHttpServer()).get(`/products/${product.id}`).expect(200);
    await request(app.getHttpServer())
      .get('/products/00000000-0000-0000-0000-000000000000')
      .expect(404);
  });

  it('POST /products should allow seller and block user/admin/guest', async () => {
    const category = await createCategory();
    const { token: sellerToken } = await createUserAndToken('seller@test.local', Role.SELLER);
    const { token: userToken } = await createUserAndToken('user@test.local', Role.USER);
    const { token: adminToken } = await createUserAndToken('admin@test.local', Role.ADMIN);

    const body = {
      title: 'Headphones X',
      description: 'Wireless headphones',
      price: 100,
      stock: 10,
      categoryId: category.id,
      images: ['img-a'],
    };

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${sellerToken}`)
      .send(body)
      .expect(201);

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${userToken}`)
      .send(body)
      .expect(403);

    await request(app.getHttpServer())
      .post('/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(403);

    await request(app.getHttpServer()).post('/products').send(body).expect(401);
  });

  it('PATCH/PUT/DELETE /products/:id should enforce seller ownership', async () => {
    const category = await createCategory();
    const { user: owner, token: ownerToken } = await createUserAndToken(
      'owner@test.local',
      Role.SELLER,
    );
    const { token: otherSellerToken } = await createUserAndToken(
      'other-seller@test.local',
      Role.SELLER,
    );
    const created = await productRepository.save({
      sellerId: owner.id,
      categoryId: category.id,
      title: 'Headphones X',
      description: 'Wireless headphones',
      price: 100,
      stock: 10,
      images: ['img-a'],
      ratingAvg: 4.5,
      ratingCount: 2,
    });

    await request(app.getHttpServer())
      .patch(`/products/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ price: 120 })
      .expect(200);

    await request(app.getHttpServer())
      .put(`/products/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Headphones X2' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/products/${created.id}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .send({ price: 130 })
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/products/${created.id}`)
      .set('Authorization', `Bearer ${otherSellerToken}`)
      .expect(400);

    await request(app.getHttpServer())
      .delete(`/products/${created.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
  });
});
