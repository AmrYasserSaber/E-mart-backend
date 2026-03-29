import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './entities/cart.entity';
import { CartItem } from './entities/cart-item.entity';
import { Product } from '../products/entities/product.entity';
import { AddToCartBody, UpdateCartItemBody } from './schemas/cart.schemas';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private readonly cartRepository: Repository<Cart>,
    @InjectRepository(CartItem)
    private readonly cartItemRepository: Repository<CartItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async getCart(userId: string) {
    let cart = await this.cartRepository.findOne({
      where: { userId },
      relations: ['items', 'items.product'],
    });

    if (!cart) {
      cart = this.cartRepository.create({ userId });
      cart = await this.cartRepository.save(cart);
      cart.items = [];
    }

    return cart;
  }

  async addItem(userId: string, addDto: AddToCartBody) {
    const cart = await this.getCart(userId);
    const product = await this.productRepository.findOne({
      where: { id: addDto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.stock < addDto.quantity) {
      throw new BadRequestException('Insufficient product stock');
    }

    let cartItem = await this.cartItemRepository.findOne({
      where: { cartId: cart.id, productId: addDto.productId },
    });

    if (cartItem) {
      const newQuantity = cartItem.quantity + addDto.quantity;
      if (product.stock < newQuantity) {
        throw new BadRequestException(
          'Insufficient product stock for this quantity',
        );
      }
      cartItem.quantity = newQuantity;
      await this.cartItemRepository.save(cartItem);
    } else {
      cartItem = this.cartItemRepository.create({
        cartId: cart.id,
        productId: product.id,
        quantity: addDto.quantity,
      });
      await this.cartItemRepository.save(cartItem);
    }

    return this.getCart(userId);
  }

  async updateItemQuantity(
    userId: string,
    itemId: string,
    updateDto: UpdateCartItemBody,
  ) {
    const cart = await this.getCart(userId);
    const cartItem = await this.cartItemRepository.findOne({
      where: { id: itemId, cartId: cart.id },
      relations: ['product'],
    });

    if (!cartItem) {
      throw new NotFoundException('Cart item not found');
    }

    if (cartItem.product.stock < updateDto.quantity) {
      throw new BadRequestException('Insufficient product stock');
    }

    cartItem.quantity = updateDto.quantity;
    await this.cartItemRepository.save(cartItem);

    return this.getCart(userId);
  }

  async removeItem(userId: string, itemId: string) {
    const cart = await this.getCart(userId);
    const result = await this.cartItemRepository.delete({
      id: itemId,
      cartId: cart.id,
    });

    if (result.affected === 0) {
      throw new NotFoundException('Cart item not found');
    }

    return this.getCart(userId);
  }

  async clearCart(userId: string) {
    const cart = await this.getCart(userId);
    await this.cartItemRepository.delete({ cartId: cart.id });
    return this.getCart(userId);
  }

  async getCartSummary(userId: string) {
    const cart = await this.getCart(userId);

    if (!cart.items || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const items = cart.items.map((item) => ({
      productId: item.productId,
      title: item.product.title,
      qty: item.quantity,
      price: item.product.price,
      stock: item.product.stock,
    }));

    for (const item of items) {
      if (item.stock < item.qty) {
        throw new BadRequestException(
          `Insufficient stock for product ${item.title}`,
        );
      }
    }

    const total = items.reduce((acc, item) => acc + item.qty * item.price, 0);

    return {
      cartId: cart.id,
      items: items.map(({ stock, ...rest }) => rest),
      total,
    };
  }
}
