import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
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
  ProductIdParamSchema,
  type CreateProductBody,
  type UpdateProductBody,
} from '../products/schemas/products.schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import { UploadFile } from '../upload/upload.service';

@ApiTags('sellers')
@Controller('sellers')
export class SellersController {
  constructor(
    private readonly sellersService: SellersService,
    private readonly productsService: ProductsService,
  ) {}

  private parseRequiredNumber(raw: unknown, field: string): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${field} must be a valid number`);
    }
    return value;
  }

  private parseCreateBody(body: Record<string, unknown>): CreateProductBody {
    const title = String(body['title'] ?? '').trim();
    const description = String(body['description'] ?? '').trim();
    const categoryId = String(body['categoryId'] ?? '').trim();

    if (!title || !description || !categoryId) {
      throw new BadRequestException(
        'title, description and categoryId are required',
      );
    }

    return {
      title,
      description,
      categoryId,
      price: this.parseRequiredNumber(body['price'], 'price'),
      stock: this.parseRequiredNumber(body['stock'], 'stock'),
      images: [],
    };
  }

  private parseUpdateBody(body: Record<string, unknown>): UpdateProductBody {
    const dto: UpdateProductBody = {};

    if (body['title'] !== undefined) dto.title = String(body['title']);
    if (body['description'] !== undefined)
      dto.description = String(body['description']);
    if (body['categoryId'] !== undefined)
      dto.categoryId = String(body['categoryId']);
    if (body['price'] !== undefined)
      dto.price = this.parseRequiredNumber(body['price'], 'price');
    if (body['stock'] !== undefined)
      dto.stock = this.parseRequiredNumber(body['stock'], 'stock');

    return dto;
  }

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
    @Body() payload: SellerRegisterDto,
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
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  createMyProduct(
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFile[] = [],
    @CurrentUser() currentUser: UserPublic,
  ) {
    const payload = this.parseCreateBody(body);
    return this.productsService.create(
      payload,
      currentUser.id,
      files,
      currentUser.role,
    );
  }

  @Get('me/products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get single own seller product' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Product details response' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({ description: 'Seller role required' })
  @UseGuards(JwtAuthGuard)
  @Validate({
    request: [{ name: 'id', type: 'param', schema: ProductIdParamSchema }],
  })
  findMyProductById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.findOneOwnedBySeller(id, currentUser.id);
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
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('images', 10))
  @Validate({
    request: [{ name: 'id', type: 'param', schema: ProductIdParamSchema }],
  })
  updateMyProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFile[] = [],
    @CurrentUser() currentUser: UserPublic,
  ) {
    const payload = this.parseUpdateBody(body);
    return this.productsService.update(
      id,
      payload,
      currentUser.id,
      files,
      currentUser.role,
    );
  }

  @Delete('me/products/:id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete product as approved seller' })
  @ApiParam({ name: 'id', type: String, format: 'uuid' })
  @ApiOkResponse({ description: 'Product deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  @ApiForbiddenResponse({
    description: 'Seller role required and store must be approved',
  })
  @UseGuards(JwtAuthGuard)
  @Validate({
    request: [{ name: 'id', type: 'param', schema: ProductIdParamSchema }],
  })
  deleteMyProduct(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.remove(id, currentUser.id, currentUser.role);
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
