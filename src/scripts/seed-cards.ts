import 'dotenv/config';
import { AppDataSource } from '../config/data-source';
import { User } from '../users/entities/user.entity';
import { UserCard } from '../payments/entities/user-card.entity';

async function seedCards() {
  await AppDataSource.initialize();
  console.log('Database initialized');

  try {
    const userRepo = AppDataSource.getRepository(User);
    const cardRepo = AppDataSource.getRepository(UserCard);

    // 1. Find the buyer user
    const user = await userRepo.findOneBy({ email: 'buyer1@emart.local' });
    if (!user) {
      console.error('User buyer1@emart.local not found. Please run npm run seed:run first.');
      return;
    }

    // 2. Clear existing cards for this user to start fresh
    await cardRepo.delete({ userId: user.id });

    // 3. Create mock cards
    const cards = [
      cardRepo.create({
        userId: user.id,
        brand: 'Visa',
        last4: '4242',
        expMonth: 12,
        expYear: 2026,
        cardholderName: 'John Buyer',
        isDefault: true,
      }),
      cardRepo.create({
        userId: user.id,
        brand: 'MasterCard',
        last4: '5555',
        expMonth: 6,
        expYear: 2025,
        cardholderName: 'John Buyer',
        isDefault: false,
      }),
    ];

    await cardRepo.save(cards);

    console.log(`Successfully added ${cards.length} cards for ${user.email}`);
  } catch (error) {
    console.error('Seed cards failed:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

void seedCards();
