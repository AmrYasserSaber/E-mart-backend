import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import type { SellerRegisterDto } from './dto/seller-register.dto';
import { Seller, SellerStatus, toSellerPublic } from './entities/seller.entity';
import { User } from '../users/entities/user.entity';
import { Product } from '../products/entities/product.entity';
import {
  SellerOwnProductsResponse,
  SellerPublicProfile,
  SellerRegisterResponse,
} from './schemas/seller.schema';

@Injectable()
export class SellersService {
  constructor(
    @InjectRepository(Seller)
    private readonly sellerRepository: Repository<Seller>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
  ) {}

  async applyForSeller(
    userId: string,
    payload: SellerRegisterDto,
  ): Promise<SellerRegisterResponse> {
    const existing = await this.sellerRepository.findOne({ where: { userId } });
    if (existing) {
      throw new ConflictException('Seller application already exists');
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const seller = this.sellerRepository.create({
      userId,
      storeName: payload.storeName.trim(),
      description: payload.description.trim(),
      status: SellerStatus.PENDING,
      rating: 0,
    });

    const saved = await this.sellerRepository.save(seller);
    const mapped = toSellerPublic(saved);
    return {
      id: mapped.id,
      userId: mapped.userId,
      storeName: mapped.storeName,
      description: mapped.description,
      status: mapped.status,
      createdAt: mapped.createdAt,
    };
  }
  //TODO: Implement real data fetching from DB instead of hardcoded values
  async findPublicProfile(id: string): Promise<SellerPublicProfile | null> {
    const seller = await this.sellerRepository.findOne({ where: { id } });
    if (!seller) return null;

    const products = [
      {
        id: randomUUID(),
        title: 'Air Max 90',
        price: 129.99,
      },
    ];

    return {
      id: seller.id,
      storeName: seller.storeName,
      description: seller.description,
      rating: seller.rating,
      totalProducts: products.length,
      products,
    };
  }

  async findMyProducts(
    userId: string,
    page: number,
    limit: number,
  ): Promise<SellerOwnProductsResponse> {
    const start = (page - 1) * limit;
    const [products, total] = await this.productRepository.findAndCount({
      where: { sellerId: userId },
      relations: { category: true },
      order: { createdAt: 'DESC' },
      skip: start,
      take: limit,
    });

    const data = products.map((product) => ({
      id: product.id,
      sellerId: product.sellerId,
      categoryId: product.categoryId,
      title: product.title,
      description: product.description,
      price: Number(product.price),
      stock: product.stock,
      images: product.images ?? [],
      ratingAvg: Number(product.ratingAvg ?? 0),
      ratingCount: product.ratingCount ?? 0,
      ordersCount: 0,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      category: product.category
        ? {
            id: product.category.id,
            name: product.category.name,
            slug: product.category.slug,
          }
        : undefined,
    }));

    return {
      data,
      total,
      page,
    };
  }
}
