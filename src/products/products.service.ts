import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductFilterDto } from './dto/product-filter.dto';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { getPagination } from '../common/utils/pagination.utils';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  private toApiProduct(product: Product) {
    return product;
  }

  async create(createProductDto: CreateProductDto, sellerId?: string) {
    const assignedSellerId = sellerId ?? createProductDto.sellerId;
    if (!assignedSellerId) {
      throw new BadRequestException('Seller id is required');
    }

    const category = await this.categoryRepository.findOne({
      where: { id: createProductDto.categoryId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const product = this.productRepository.create({
      ...createProductDto,
      sellerId: assignedSellerId,
      ratingAvg: createProductDto.ratingAvg ?? 0,
      ratingCount: createProductDto.ratingCount ?? 0,
    });
    const saved = await this.productRepository.save(product);
    return this.toApiProduct(saved);
  }

  async findAll(filters: ProductFilterDto) {
    const { page, limit, skip } = getPagination(filters);
    const qb = this.productRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category');

    if (filters.categoryId) {
      qb.andWhere('product.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }
    if (filters.minPrice !== undefined) {
      qb.andWhere('product.price >= :minPrice', { minPrice: filters.minPrice });
    }
    if (filters.maxPrice !== undefined) {
      qb.andWhere('product.price <= :maxPrice', { maxPrice: filters.maxPrice });
    }
    if (filters.search) {
      qb.andWhere(
        '(LOWER(product.title) LIKE :search OR LOWER(product.description) LIKE :search)',
        { search: `%${filters.search.toLowerCase()}%` },
      );
    }

    if (filters.sort === 'price_asc') qb.orderBy('product.price', 'ASC');
    else if (filters.sort === 'price_desc') qb.orderBy('product.price', 'DESC');
    else qb.orderBy('product.createdAt', 'DESC');

    qb.skip(skip).take(limit);

    const [products, total] = await qb.getManyAndCount();
    return {
      data: products.map((product) => this.toApiProduct(product)),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
    };
  }

  async findOne(id: string) {
    const product = await this.productRepository.findOne({
      where: { id },
      relations: {
        category: true,
        reviews: true,
      },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return this.toApiProduct(product);
  }

  async update(
    id: string,
    updateProductDto: UpdateProductDto,
    sellerId?: string,
  ) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (sellerId && product.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own products');
    }

    if (updateProductDto.categoryId) {
      const category = await this.categoryRepository.findOne({
        where: { id: updateProductDto.categoryId },
      });
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    Object.assign(product, updateProductDto);
    const updated = await this.productRepository.save(product);
    return this.toApiProduct(updated);
  }

  async remove(id: string, sellerId?: string) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (sellerId && product.sellerId !== sellerId) {
      throw new BadRequestException('You can only delete your own products');
    }
    await this.productRepository.remove(product);
    return { message: 'Product deleted successfully' };
  }
}
