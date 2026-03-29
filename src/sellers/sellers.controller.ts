import {
  Controller,
  Get,
  Post,
  Patch,
  UseGuards,
  ParseUUIDPipe,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { SellersService } from './sellers.service';
import { ProductsService } from '../products/products.service';
import type { SellerRegisterDto } from './dto/seller-register.dto';
import {
  RegisterSellerBodySchema,
  SellerOwnProductsResponse,
  SellerOwnProductsResponseSchema,
  SellerPublicProfile,
  SellerPublicProfileSchema,
  SellerRegisterResponse,
  SellerRegisterResponseSchema,
} from './schemas/seller.schema';
import {
  CreateProductBodySchema,
  ProductIdParamSchema,
  UpdateProductBodySchema,
  type CreateProductBody,
  type UpdateProductBody,
} from '../products/schemas/products.schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly sellersService: SellersService,
    private readonly productsService: ProductsService,
  ) {}

  @Post('apply')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Apply to become a seller' })
  @ApiBody({ schema: RegisterSellerBodySchema })
  @ApiCreatedResponse({ schema: SellerRegisterResponseSchema })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Validate({
    request: [{ type: 'body', schema: RegisterSellerBodySchema }],
    response: { schema: SellerRegisterResponseSchema, stripUnknownProps: true },
  })
  applyForSeller(
    payload: SellerRegisterDto,
    @CurrentUser() currentUser: UserPublic,
  ): Promise<SellerRegisterResponse> {
    return this.sellersService.applyForSeller(currentUser.id, payload);
  }

  @Get('me/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get own seller product listings' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ description: 'Seller products list response' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Seller role required' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Validate({
    response: {
      schema: SellerOwnProductsResponseSchema,
      stripUnknownProps: true,
    },
  })
  findMyProducts(
    @CurrentUser() currentUser: UserPublic,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ): Promise<SellerOwnProductsResponse> {
    const normalizedPage = page < 1 ? 1 : page;
    const normalizedLimit = limit < 1 ? 20 : Math.min(limit, 100);
    return this.sellersService.findMyProducts(
      currentUser.id,
      normalizedPage,
      normalizedLimit,
    );
  }

  @Post('me/products')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create product as approved seller' })
  @ApiBody({
    description:
      'Create product payload: title, description, price, stock, categoryId, images and optional rating fields',
  })
  @ApiCreatedResponse({ description: 'Product created successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Seller role required and store must be approved',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Validate({
    request: [
      {
        type: 'body',
        schema: CreateProductBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  createMyProduct(
    payload: CreateProductBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.create(payload, currentUser.id);
  }

  @Patch('me/products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update product as approved seller' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Product updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Seller role required and store must be approved',
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Validate({
    request: [
      { name: 'id', type: 'param', schema: ProductIdParamSchema },
      {
        type: 'body',
        schema: UpdateProductBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  updateMyProduct(
    id: string,
    payload: UpdateProductBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.update(id, payload, currentUser.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get public seller profile' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Seller public profile response' })
  @ApiNotFoundResponse({ description: 'Seller not found' })
  @Validate({
    response: { schema: SellerPublicProfileSchema, stripUnknownProps: true },
  })
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SellerPublicProfile> {
    const seller = await this.sellersService.findPublicProfile(id);
    if (!seller) {
      throw new NotFoundException('Seller not found');
    }
    return seller;
  }
}
