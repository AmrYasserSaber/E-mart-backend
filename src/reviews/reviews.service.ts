import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { Review } from './entities/review.entity';
import { Product } from '../products/entities/product.entity';
import { User } from '../users/entities/user.entity';
import { getPagination } from '../common/utils/pagination.utils';
import { Role } from '../common/enums/role.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    productId: string,
    userId: string,
    createReviewDto: CreateReviewDto,
  ) {
    const product = await this.productRepository.findOne({
      where: { id: productId },
    });
    if (!product) {
      throw new NotFoundException('Product not found');
    }
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const review = this.reviewRepository.create({
      ...createReviewDto,
      productId,
      userId,
    });
    return this.reviewRepository.save(review);
  }

  async findAll(productId: string, page?: number, limit?: number) {
    const {
      page: currentPage,
      limit: currentLimit,
      skip,
    } = getPagination({
      page,
      limit,
    });
    const [data, total] = await this.reviewRepository.findAndCount({
      where: { productId },
      relations: { user: true },
      order: { createdAt: 'DESC' },
      skip,
      take: currentLimit,
    });
    return {
      data,
      total,
      page: currentPage,
      pages: Math.ceil(total / currentLimit) || 1,
    };
  }

  async findOne(id: string) {
    const review = await this.reviewRepository.findOne({
      where: { id },
      relations: { user: true, product: true },
    });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }

  async update(
    id: string,
    userId: string,
    userRole: Role,
    updateReviewDto: UpdateReviewDto,
  ) {
    const review = await this.findOne(id);
    if (review.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only update your own reviews');
    }
    Object.assign(review, updateReviewDto);
    return this.reviewRepository.save(review);
  }

  async remove(id: string, userId: string, userRole: Role) {
    const review = await this.findOne(id);
    if (review.userId !== userId && userRole !== Role.ADMIN) {
      throw new ForbiddenException('You can only delete your own reviews');
    }
    await this.reviewRepository.remove(review);
    return { message: 'Review deleted successfully' };
  }
}
