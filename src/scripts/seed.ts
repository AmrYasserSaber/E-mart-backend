import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { In } from 'typeorm';
import { AppDataSource } from '../config/data-source';
import { Role } from '../common/enums/role.enum';
import { User } from '../users/entities/user.entity';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { Review } from '../reviews/entities/review.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';

const BCRYPT_ROUNDS = 12;
const DEFAULT_PASSWORD = 'Pass123!';

async function runSeed() {
  await AppDataSource.initialize();

  try {
    const hasUsersTable = await AppDataSource.query(
      "SELECT to_regclass('public.users') IS NOT NULL AS exists",
    );
    if (!hasUsersTable?.[0]?.exists) {
      throw new Error(
        'Database schema is not initialized. Run migrations first: npm run migration:run',
      );
    }

    const result = await AppDataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const categoryRepo = manager.getRepository(Category);
      const productRepo = manager.getRepository(Product);
      const reviewRepo = manager.getRepository(Review);
      const refreshTokenRepo = manager.getRepository(RefreshToken);

      const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, BCRYPT_ROUNDS);
      const now = new Date();

      const userFixtures = [
        {
          firstName: 'System',
          lastName: 'Admin',
          email: 'admin@emart.local',
          role: Role.ADMIN,
        },
        {
          firstName: 'Sarah',
          lastName: 'Seller',
          email: 'seller@emart.local',
          role: Role.SELLER,
        },
        {
          firstName: 'Ali',
          lastName: 'Buyer',
          email: 'buyer1@emart.local',
          role: Role.USER,
        },
        {
          firstName: 'Mona',
          lastName: 'Customer',
          email: 'buyer2@emart.local',
          role: Role.USER,
        },
      ];

      await userRepo.upsert(
        userFixtures.map((user) => ({
          ...user,
          passwordHash,
          active: true,
          emailVerifiedAt: now,
          emailVerificationCodeHash: null,
          emailVerificationExpiresAt: null,
        })),
        ['email'],
      );

      const users = await userRepo.find({
        where: { email: In(userFixtures.map((user) => user.email)) },
      });
      const userByEmail = new Map(users.map((user) => [user.email, user]));

      const rootCategories = [
        { name: 'Electronics', slug: 'electronics', parentId: null as string | null },
        { name: 'Fashion', slug: 'fashion', parentId: null as string | null },
      ];

      await categoryRepo.upsert(rootCategories, ['slug']);
      const roots = await categoryRepo.find({
        where: { slug: In(rootCategories.map((category) => category.slug)) },
      });
      const rootBySlug = new Map(roots.map((category) => [category.slug, category]));

      const childCategories = [
        {
          name: 'Headphones',
          slug: 'headphones',
          parentId: rootBySlug.get('electronics')?.id ?? null,
        },
        {
          name: 'Sneakers',
          slug: 'sneakers',
          parentId: rootBySlug.get('fashion')?.id ?? null,
        },
      ];

      await categoryRepo.upsert(childCategories, ['slug']);
      const categories = await categoryRepo.find({
        where: {
          slug: In([...rootCategories, ...childCategories].map((category) => category.slug)),
        },
      });
      const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

      const seller = userByEmail.get('seller@emart.local');
      if (!seller) {
        throw new Error('Seed prerequisite failed: seller user not found');
      }

      const productFixtures = [
        {
          title: 'Noise Cancelling Headphones X1',
          description: 'Over-ear wireless headphones with ANC and 30h battery.',
          price: 149.99,
          stock: 25,
          categorySlug: 'headphones',
          images: ['https://cdn.seed.local/products/headphones-x1.jpg'],
        },
        {
          title: 'Urban Runner Sneakers',
          description: 'Daily lightweight sneakers with breathable mesh.',
          price: 89.5,
          stock: 40,
          categorySlug: 'sneakers',
          images: ['https://cdn.seed.local/products/urban-runner.jpg'],
        },
      ];

      const existingProducts = await productRepo.find({
        where: { title: In(productFixtures.map((product) => product.title)) },
      });
      if (existingProducts.length > 0) {
        await reviewRepo.delete({ productId: In(existingProducts.map((product) => product.id)) });
        await productRepo.delete({ id: In(existingProducts.map((product) => product.id)) });
      }

      const createdProducts = await productRepo.save(
        productFixtures.map((product) => {
          const category = categoryBySlug.get(product.categorySlug);
          if (!category) {
            throw new Error(`Seed prerequisite failed: category ${product.categorySlug} missing`);
          }
          return productRepo.create({
            sellerId: seller.id,
            categoryId: category.id,
            title: product.title,
            description: product.description,
            price: product.price,
            stock: product.stock,
            images: product.images,
            ratingAvg: 0,
            ratingCount: 0,
          });
        }),
      );
      const productByTitle = new Map(createdProducts.map((product) => [product.title, product]));

      const reviewFixtures = [
        {
          productTitle: 'Noise Cancelling Headphones X1',
          userEmail: 'buyer1@emart.local',
          rating: 5,
          comment: 'Excellent noise isolation and clear sound.',
        },
        {
          productTitle: 'Noise Cancelling Headphones X1',
          userEmail: 'buyer2@emart.local',
          rating: 4,
          comment: 'Very good value, slightly tight fit.',
        },
        {
          productTitle: 'Urban Runner Sneakers',
          userEmail: 'buyer1@emart.local',
          rating: 4,
          comment: 'Comfortable for long walks.',
        },
      ];

      await reviewRepo.save(
        reviewFixtures.map((review) => {
          const product = productByTitle.get(review.productTitle);
          const user = userByEmail.get(review.userEmail);
          if (!product || !user) {
            throw new Error(
              `Seed prerequisite failed: cannot map review ${review.productTitle}/${review.userEmail}`,
            );
          }
          return reviewRepo.create({
            productId: product.id,
            userId: user.id,
            rating: review.rating,
            comment: review.comment,
          });
        }),
      );

      for (const product of createdProducts) {
        const ratings = await reviewRepo.find({
          where: { productId: product.id },
        });
        const ratingCount = ratings.length;
        const ratingAvg =
          ratingCount === 0
            ? 0
            : Number(
                (
                  ratings.reduce((acc, item) => acc + item.rating, 0) / ratingCount
                ).toFixed(2),
              );
        await productRepo.update(
          { id: product.id },
          {
            ratingCount,
            ratingAvg,
          },
        );
      }

      const refreshSeedRawToken = 'seed-refresh-token-v1';
      const refreshTokenHash = createHash('sha256')
        .update(refreshSeedRawToken)
        .digest('hex');
      const buyer = userByEmail.get('buyer1@emart.local');
      if (!buyer) {
        throw new Error('Seed prerequisite failed: buyer user missing');
      }
      await refreshTokenRepo.delete({ tokenHash: refreshTokenHash });
      await refreshTokenRepo.save(
        refreshTokenRepo.create({
          userId: buyer.id,
          tokenHash: refreshTokenHash,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }),
      );

      return {
        users: users.length,
        categories: categories.length,
        products: createdProducts.length,
        reviews: reviewFixtures.length,
        refreshTokens: 1,
        credentials: userFixtures.map((user) => ({
          email: user.email,
          password: DEFAULT_PASSWORD,
          role: user.role,
        })),
      };
    });

    // eslint-disable-next-line no-console
    console.log('Seed completed successfully.');
    // eslint-disable-next-line no-console
    console.table(result.credentials);
    // eslint-disable-next-line no-console
    console.log(
      `Inserted/updated -> users: ${result.users}, categories: ${result.categories}, products: ${result.products}, reviews: ${result.reviews}, refresh_tokens: ${result.refreshTokens}`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

void runSeed().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
