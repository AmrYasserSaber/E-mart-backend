import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { WishlistItem } from './entities/wishlist-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { getPagination } from '../common/utils/pagination.utils';

@Injectable()
export class WishlistService {
  constructor(
    @InjectRepository(WishlistItem)
    private readonly wishlistItemRepository: Repository<WishlistItem>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    private readonly cartService: CartService,
  ) {}

  async getWishlist(userId: string, page = 1, limit = 20) {
    const { skip } = getPagination({ page, limit });

    const [items, total] = await this.wishlistItemRepository.findAndCount({
      where: { userId },
      relations: ['product', 'product.category'],
      order: { addedAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: items,
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  async addItem(userId: string, productId: string): Promise<WishlistItem> {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const existing = await this.wishlistItemRepository.findOne({
      where: { userId, productId },
    });
    if (existing) {
      return existing;
    }

    const item = this.wishlistItemRepository.create({ userId, productId });
    return this.wishlistItemRepository.save(item);
  }

  async bulkAddItems(
    userId: string,
    productIds: string[],
  ): Promise<{ added: number; skipped: number }> {
    const uniqueIds = [...new Set(productIds)];

    const products = await this.productRepository.find({
      select: ['id'],
      where: { id: In(uniqueIds) },
    });
    if (products.length !== uniqueIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missing = uniqueIds.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Products not found: ${missing.join(', ')}`);
    }

    const existing = await this.wishlistItemRepository.find({
      where: { userId, productId: In(uniqueIds) },
      select: ['productId'],
    });
    const existingIds = new Set(existing.map((i) => i.productId));

    const toInsert = uniqueIds
      .filter((id) => !existingIds.has(id))
      .map((productId) =>
        this.wishlistItemRepository.create({ userId, productId }),
      );

    if (toInsert.length > 0) {
      await this.wishlistItemRepository.save(toInsert);
    }

    return { added: toInsert.length, skipped: existingIds.size };
  }

  async removeItem(userId: string, productId: string): Promise<void> {
    const result = await this.wishlistItemRepository.delete({
      userId,
      productId,
    });
    if (result.affected === 0) {
      throw new NotFoundException('Product not in wishlist');
    }
  }

  async clearWishlist(userId: string): Promise<{ deleted: number }> {
    const result = await this.wishlistItemRepository.delete({ userId });
    return { deleted: result.affected ?? 0 };
  }

  async isInWishlist(
    userId: string,
    productId: string,
  ): Promise<{ inWishlist: boolean }> {
    const exists = await this.wishlistItemRepository.existsBy({
      userId,
      productId,
    });
    return { inWishlist: exists };
  }

  async getWishlistProductIds(
    userId: string,
  ): Promise<{ productIds: string[] }> {
    const items = await this.wishlistItemRepository.find({
      where: { userId },
      select: ['productId'],
      order: { addedAt: 'DESC' },
    });
    return { productIds: items.map((i) => i.productId) };
  }

  async getCount(userId: string): Promise<{ count: number }> {
    const count = await this.wishlistItemRepository.countBy({ userId });
    return { count };
  }

  async moveToCart(userId: string, productId: string): Promise<void> {
    const item = await this.wishlistItemRepository.findOne({
      where: { userId, productId },
    });
    if (!item) {
      throw new NotFoundException('Product not in wishlist');
    }

    await this.cartService.addItem(userId, { productId, quantity: 1 });
    await this.wishlistItemRepository.remove(item);
  }
}
