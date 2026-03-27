import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { UpdateReviewDto } from './dto/update-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';

@ApiTags('reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post(':productId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() createReviewDto: CreateReviewDto,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.reviewsService.create(
      productId,
      currentUser.id,
      createReviewDto,
    );
  }

  @Get('item/:reviewId')
  findOne(@Param('reviewId', ParseUUIDPipe) reviewId: string) {
    return this.reviewsService.findOne(reviewId);
  }

  @Get(':productId')
  findAll(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.reviewsService.findAll(productId, page, limit);
  }

  @Patch(':reviewId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() updateReviewDto: UpdateReviewDto,
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
  remove(
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.reviewsService.remove(
      reviewId,
      currentUser.id,
      currentUser.role,
    );
  }
}
