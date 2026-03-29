import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { ReviewsService } from './reviews.service';
import {
  CreateReviewBodySchema,
  ReviewIdParamSchema,
  ReviewProductIdParamSchema,
  ReviewsListQuerySchema,
  UpdateReviewBodySchema,
  type CreateReviewBody,
  type ReviewsListQuery,
  type UpdateReviewBody,
} from './schemas/reviews.schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import { ValidateQueryParams } from '../common/decorators/validate-query-params.decorator';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Validate({
    request: [
      { name: 'productId', type: 'param', schema: ReviewProductIdParamSchema },
      {
        type: 'body',
        schema: CreateReviewBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  create(
    productId: string,
    createReviewDto: CreateReviewBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.reviewsService.create(
      productId,
      currentUser.id,
      createReviewDto,
    );
  }

  @Get('item/:reviewId')
  @Validate({
    request: [
      { name: 'reviewId', type: 'param', schema: ReviewIdParamSchema },
    ],
  })
  findOne(reviewId: string) {
    return this.reviewsService.findOne(reviewId);
  }

  @Get(':productId')
  @ValidateQueryParams(ReviewsListQuerySchema)
  @Validate({
    request: [
      { name: 'productId', type: 'param', schema: ReviewProductIdParamSchema },
    ],
  })
  findAll(productId: string, @Query() query: ReviewsListQuery) {
    return this.reviewsService.findAll(productId, query.page, query.limit);
  }

  @Patch(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Validate({
    request: [
      { name: 'reviewId', type: 'param', schema: ReviewIdParamSchema },
      {
        type: 'body',
        schema: UpdateReviewBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  update(
    reviewId: string,
    updateReviewDto: UpdateReviewBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.reviewsService.update(
      reviewId,
      currentUser.id,
      currentUser.role,
      updateReviewDto,
    );
  }

  @Delete(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Validate({
    request: [
      { name: 'reviewId', type: 'param', schema: ReviewIdParamSchema },
    ],
  })
  remove(reviewId: string, @CurrentUser() currentUser: UserPublic) {
    return this.reviewsService.remove(
      reviewId,
      currentUser.id,
      currentUser.role,
    );
  }
}
