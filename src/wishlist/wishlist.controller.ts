import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import { ValidateQueryParams } from '../common/decorators/validate-query-params.decorator';
import {
  AddToWishlistBodySchema,
  BulkAddToWishlistBodySchema,
  WishlistProductIdParamSchema,
  WishlistQuerySchema,
  type AddToWishlistBody,
  type BulkAddToWishlistBody,
  type WishlistQuery,
} from './schemas/wishlist.schemas';

@ApiTags('wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get paginated wishlist with full product data' })
  @ValidateQueryParams(WishlistQuerySchema)
  getWishlist(
    @Query() query: WishlistQuery,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.wishlistService.getWishlist(
      currentUser.id,
      query.page,
      query.limit,
    );
  }

  @Get('ids')
  @ApiOperation({
    summary: 'Get all wishlisted product IDs (lightweight, for UI heart icons)',
  })
  getWishlistProductIds(@CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.getWishlistProductIds(currentUser.id);
  }

  @Get('count')
  @ApiOperation({ summary: 'Get total wishlist item count' })
  getCount(@CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.getCount(currentUser.id);
  }

  @Get('check/:productId')
  @ApiOperation({ summary: 'Check if a specific product is in the wishlist' })
  @Validate({
    request: [
      {
        type: 'param',
        name: 'productId',
        schema: WishlistProductIdParamSchema,
      },
    ],
  })
  isInWishlist(productId: string, @CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.isInWishlist(currentUser.id, productId);
  }

  @Post()
  @ApiOperation({ summary: 'Add a product to the wishlist (idempotent)' })
  @Validate({
    request: [
      {
        type: 'body',
        schema: AddToWishlistBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  addItem(body: AddToWishlistBody, @CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.addItem(currentUser.id, body.productId);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Bulk-add up to 50 products to the wishlist' })
  @Validate({
    request: [
      {
        type: 'body',
        schema: BulkAddToWishlistBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  bulkAddItems(
    body: BulkAddToWishlistBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.wishlistService.bulkAddItems(currentUser.id, body.productIds);
  }

  @Post('move-to-cart/:productId')
  @ApiOperation({
    summary: 'Move a product from wishlist to cart (quantity: 1)',
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Validate({
    request: [
      {
        name: 'productId',
        type: 'param',
        schema: WishlistProductIdParamSchema,
      },
    ],
  })
  moveToCart(productId: string, @CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.moveToCart(currentUser.id, productId);
  }

  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product from the wishlist' })
  @HttpCode(HttpStatus.NO_CONTENT)
  @Validate({
    request: [
      {
        name: 'productId',
        type: 'param',
        schema: WishlistProductIdParamSchema,
      },
    ],
  })
  removeItem(productId: string, @CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.removeItem(currentUser.id, productId);
  }

  @Delete()
  @ApiOperation({ summary: 'Clear the entire wishlist' })
  clearWishlist(@CurrentUser() currentUser: UserPublic) {
    return this.wishlistService.clearWishlist(currentUser.id);
  }
}
