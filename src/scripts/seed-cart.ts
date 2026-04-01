import 'dotenv/config';
import { AppDataSource } from '../config/data-source';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import { Cart } from '../cart/entities/cart.entity';
import { CartItem } from '../cart/entities/cart-item.entity';

async function seedCart() {
  await AppDataSource.initialize();
  console.log('Database initialized');

  try {
    const userRepo = AppDataSource.getRepository(User);
    const productRepo = AppDataSource.getRepository(Product);
    const cartRepo = AppDataSource.getRepository(Cart);
    const cartItemRepo = AppDataSource.getRepository(CartItem);

    // 1. Find the buyer user
    const user = await userRepo.findOneBy({ email: 'buyer1@emart.local' });
    if (!user) {
      console.error('User buyer1@emart.local not found. Please run npm run seed:run first.');
      return;
    }

    // 2. Get or create cart
    let cart = await cartRepo.findOneBy({ userId: user.id });
    if (!cart) {
      cart = cartRepo.create({ userId: user.id });
      await cartRepo.save(cart);
    }

    // 3. Clear existing items to start fresh
    await cartItemRepo.delete({ cartId: cart.id });

    // 4. Find all products
    const products = await productRepo.find();
    if (products.length === 0) {
      console.error('No products found in database. Please run npm run seed:run first.');
      return;
    }

    // 5. Add products to cart
    const itemsToSeed = products.slice(0, 3).map((product, index) => {
      return cartItemRepo.create({
        cartId: cart!.id,
        productId: product.id,
        quantity: index + 1, // 1, 2, 3...
      });
    });

    await cartItemRepo.save(itemsToSeed);

    console.log(`Successfully added ${itemsToSeed.length} items to the cart for ${user.email}`);
    console.log('You can now log in with:');
    console.log('Email: buyer1@emart.local');
    console.log('Password: Pass123!');
  } catch (error) {
    console.error('Seed cart failed:', error);
  } finally {
    await AppDataSource.destroy();
  }
}

void seedCart();
