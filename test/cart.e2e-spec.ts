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
import { CartModule } from '../src/cart/cart.module';
import { CategoriesModule } from '../src/categories/categories.module';
import { ProductsModule } from '../src/products/products.module';
import { User } from '../src/users/entities/user.entity';
import { RefreshToken } from '../src/auth/entities/refresh-token.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { Review } from '../src/reviews/entities/review.entity';
import { Cart } from '../src/cart/entities/cart.entity';
import { CartItem } from '../src/cart/entities/cart-item.entity';
import { Role } from '../src/common/enums/role.enum';

function assertSafeTestDbName(dbName: string | undefined): asserts dbName {
  if (!dbName) {
    throw new Error('TEST_DB_NAME must include "test" or end with "_test".');
  }
}

describe('Cart (e2e)', () => {
  let app: INestApplication<App>;
  let userRepository: Repository<User>;
  let categoryRepository: Repository<Category>;
  let productRepository: Repository<Product>;
  let cartRepository: Repository<Cart>;
  let cartItemRepository: Repository<CartItem>;

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
          entities: [User, RefreshToken, Category, Product, Review, Cart, CartItem],
          synchronize: true,
          dropSchema: true,
        }),
        AuthModule,
        CategoriesModule,
        ProductsModule,
        CartModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get(getRepositoryToken(User));
    categoryRepository = moduleFixture.get(getRepositoryToken(Category));
    productRepository = moduleFixture.get(getRepositoryToken(Product));
    cartRepository = moduleFixture.get(getRepositoryToken(Cart));
    cartItemRepository = moduleFixture.get(getRepositoryToken(CartItem));
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(async () => {
    await cartItemRepository.createQueryBuilder().delete().execute();
    await cartRepository.createQueryBuilder().delete().execute();
    await productRepository.createQueryBuilder().delete().execute();
    await categoryRepository.createQueryBuilder().delete().execute();
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
    });
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return { user, token: loginResponse.body.accessToken as string };
  }

  it('should get an empty cart initially', async () => {
    const { token } = await createUserAndToken('user@test.local', Role.USER);
    const res = await request(app.getHttpServer())
      .get('/cart')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.items).toHaveLength(0);
  });

  it('should add an item to the cart', async () => {
    const seller = await userRepository.save({
      firstName: 'Seller',
      lastName: 'Seller',
      email: 'seller@test.local',
      passwordHash: 'hash',
      role: Role.SELLER,
      active: true,
    });

    const category = await categoryRepository.save({
      name: 'Cat',
      slug: 'cat',
    });

    const product = await productRepository.save({
      sellerId: seller.id,
      categoryId: category.id,
      title: 'P1',
      description: 'D1',
      price: 10,
      stock: 5,
    });

    const { token } = await createUserAndToken('user@test.local', Role.USER);
    const res = await request(app.getHttpServer())
      .post('/cart')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 2 })
      .expect(201);

    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].quantity).toBe(2);
    expect(res.body.items[0].productId).toBe(product.id);
  });
});
