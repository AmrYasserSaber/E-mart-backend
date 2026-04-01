import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  CreateProductBody,
  ProductFilterQuery,
  UpdateProductBody,
} from './schemas/products.schemas';
import { Product } from './entities/product.entity';
import { Category } from '../categories/entities/category.entity';
import { getPagination } from '../common/utils/pagination.utils';
import { Seller, SellerStatus } from '../sellers/entities/seller.entity';
import { UploadFile, UploadService } from '../upload/upload.service';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
    @InjectRepository(Seller)
    private readonly sellerRepository: Repository<Seller>,
    private readonly uploadService: UploadService,
  ) {}

  private async ensureSellerCanManageProducts(sellerUserId: string) {
    const seller = await this.sellerRepository.findOne({
      where: { userId: sellerUserId },
    });

    if (!seller) {
      // Legacy accounts may already have seller role without a seller profile row.
      // Allow them to manage products using role-based access only.
      return;
    }

    if (seller.status !== SellerStatus.APPROVED) {
      throw new ForbiddenException(
        'Seller store must be approved before managing products',
      );
    }
  }

  private toApiProduct(product: Product) {
    return product;
  }

  private async uploadProductImages(
    productId: string,
    files: UploadFile[],
  ): Promise<string[]> {
    const uploaded = await this.uploadService.uploadImages(
      files,
      `/emart/products/${productId}`,
    );

    return uploaded.map((item) => item.url);
  }

  async create(
    createProductDto: CreateProductBody,
    sellerId?: string,
    files: UploadFile[] = [],
    actorRole: Role = Role.SELLER,
  ) {
    const assignedSellerId = sellerId ?? createProductDto.sellerId;
    if (!assignedSellerId) {
      throw new BadRequestException('Seller id is required');
    }

    if (actorRole !== Role.ADMIN) {
      await this.ensureSellerCanManageProducts(assignedSellerId);
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
      images: createProductDto.images ?? [],
      ratingAvg: createProductDto.ratingAvg ?? 0,
      ratingCount: createProductDto.ratingCount ?? 0,
    });
    let saved = await this.productRepository.save(product);

    if (files.length) {
      const uploadedUrls = await this.uploadProductImages(saved.id, files);
      saved.images = uploadedUrls;
      saved = await this.productRepository.save(saved);
    }

    return this.toApiProduct(saved);
  }

  async findAll(filters: ProductFilterQuery) {
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

  async findOneOwnedBySeller(id: string, sellerId: string) {
    const product = await this.productRepository.findOne({
      where: { id, sellerId },
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
    updateProductDto: UpdateProductBody,
    sellerId?: string,
    files: UploadFile[] = [],
    actorRole: Role = Role.SELLER,
  ) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (actorRole !== Role.ADMIN && sellerId && product.sellerId !== sellerId) {
      throw new BadRequestException('You can only update your own products');
    }

    if (actorRole !== Role.ADMIN && sellerId) {
      await this.ensureSellerCanManageProducts(sellerId);
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

    if (files.length) {
      const uploadedUrls = await this.uploadProductImages(product.id, files);
      product.images = uploadedUrls;
    }

    const updated = await this.productRepository.save(product);
    return this.toApiProduct(updated);
  }

  async remove(id: string, sellerId?: string, actorRole: Role = Role.SELLER) {
    const product = await this.productRepository.findOne({ where: { id } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    if (actorRole !== Role.ADMIN && sellerId && product.sellerId !== sellerId) {
      throw new BadRequestException('You can only delete your own products');
    }
    if (actorRole !== Role.ADMIN && sellerId) {
      await this.ensureSellerCanManageProducts(sellerId);
    }
    await this.productRepository.remove(product);
    return { message: 'Product deleted successfully' };
  }
}
