import 'dotenv/config';
import { AppDataSource } from '../config/data-source';
import { User } from '../users/entities/user.entity';
import { Payment, PaymentStatus } from '../payments/entities/payment.entity';

const SEED_TAG = 'revenue-mock-v1';

function utcDateAtNoon(daysAgo: number): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - daysAgo,
      12,
      0,
      0,
      0,
    ),
  );
}

async function seedRevenue() {
  await AppDataSource.initialize();
  console.log('Database initialized');

  try {
    const userRepo = AppDataSource.getRepository(User);
    const paymentRepo = AppDataSource.getRepository(Payment);

    const users = await userRepo.find({
      where: [{ email: 'buyer1@emart.local' }, { email: 'buyer2@emart.local' }],
      order: { createdAt: 'ASC' },
    });

    if (users.length === 0) {
      console.error('No seed buyers found. Run npm run seed:run first.');
      return;
    }

    // Remove only previously-seeded revenue mocks, keeping real payment records untouched.
    await paymentRepo
      .createQueryBuilder()
      .delete()
      .where("rawResponse ->> 'seedTag' = :seedTag", { seedTag: SEED_TAG })
      .execute();

    const revenuePayments: Payment[] = [];

    // Seed one payment per day for the last 365 days.
    // This keeps 12-month aggregation and 30-day aggregation consistent.
    for (let dayAgo = 364; dayAgo >= 0; dayAgo -= 1) {
      const createdAt = utcDateAtNoon(dayAgo);
      const dayIndex = 364 - dayAgo;
      const weeklyWave = (dayIndex % 7) * 7;
      const monthlyWave = (dayIndex % 30) * 1.2;
      const trend = dayIndex * 0.25;
      const amount = Number(
        (180 + weeklyWave + monthlyWave + trend).toFixed(2),
      );
      const user = users[dayAgo % users.length];

      revenuePayments.push(
        paymentRepo.create({
          userId: user.id,
          orderId: null,
          gateway: 'seeded_analytics',
          externalId: `seed-revenue-${createdAt.toISOString().slice(0, 10)}`,
          status: PaymentStatus.SUCCESS,
          amount,
          currency: 'EGP',
          redirectUrl: null,
          rawResponse: {
            seedTag: SEED_TAG,
            kind: 'daily-series',
          },
          createdAt,
          updatedAt: createdAt,
        }),
      );
    }

    await paymentRepo.save(revenuePayments);

    console.log(
      `Seeded ${revenuePayments.length} successful mock payments for revenue analytics.`,
    );
    console.log('Seed tag:', SEED_TAG);
  } catch (error) {
    console.error('Seed revenue failed:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

void seedRevenue();
