import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import {
  AddToCartBodySchema,
  CartItemIdParamSchema,
  UpdateCartItemBodySchema,
  type AddToCartBody,
  type UpdateCartItemBody,
} from './schemas/cart.schemas';

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@CurrentUser() currentUser: UserPublic) {
    return this.cartService.getCart(currentUser.id);
  }

  @Post()
  @Validate({
    request: [
      {
        type: 'body',
        schema: AddToCartBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  addItem(
    addDto: AddToCartBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.cartService.addItem(currentUser.id, addDto);
  }

  @Put('items/:itemId')
  @Validate({
    request: [
      { name: 'itemId', type: 'param', schema: CartItemIdParamSchema },
      {
        type: 'body',
        schema: UpdateCartItemBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  updateItemQuantity(
    itemId: string,
    updateDto: UpdateCartItemBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.cartService.updateItemQuantity(currentUser.id, itemId, updateDto);
  }

  @Delete('items/:itemId')
  @Validate({
    request: [
      { name: 'itemId', type: 'param', schema: CartItemIdParamSchema },
    ],
  })
  removeItem(
    itemId: string,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.cartService.removeItem(currentUser.id, itemId);
  }

  @Delete()
  clearCart(@CurrentUser() currentUser: UserPublic) {
    return this.cartService.clearCart(currentUser.id);
  }
}
