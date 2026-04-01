import {
  BadRequestException,
  Body,
  Controller,
  Param,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  UseGuards,
  Put,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { ProductsService } from './products.service';
import {
  ProductFilterQuerySchema,
  ProductIdParamSchema,
  type CreateProductBody,
  type ProductFilterQuery,
  type UpdateProductBody,
} from './schemas/products.schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import { ValidateQueryParams } from '../common/decorators/validate-query-params.decorator';
import { UploadFile } from '../upload/upload.service';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  private parseRequiredNumber(raw: unknown, field: string): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      throw new BadRequestException(`${field} must be a valid number`);
    }
    return value;
  }

  private parseOptionalNumber(raw: unknown): number | undefined {
    if (raw === undefined || raw === null || raw === '') {
      return undefined;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
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
      ratingAvg: this.parseOptionalNumber(body['ratingAvg']),
      ratingCount: this.parseOptionalNumber(body['ratingCount']),
      sellerId:
        body['sellerId'] === undefined || body['sellerId'] === null
          ? undefined
          : String(body['sellerId']),
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

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('images', 10))
  create(
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFile[] = [],
    @CurrentUser() currentUser: UserPublic,
  ) {
    const createProductDto = this.parseCreateBody(body);
    return this.productsService.create(
      createProductDto,
      currentUser.id,
      files,
      currentUser.role,
    );
  }

  @Get()
  @ValidateQueryParams(ProductFilterQuerySchema)
  findAll(@Query() filters: ProductFilterQuery) {
    return this.productsService.findAll(filters);
  }

  @Get(':id')
  @Validate({
    request: [{ name: 'id', type: 'param', schema: ProductIdParamSchema }],
  })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('images', 10))
  replace(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFile[] = [],
    @CurrentUser() currentUser: UserPublic,
  ) {
    const updateProductDto = this.parseUpdateBody(body);
    return this.productsService.update(
      id,
      updateProductDto,
      currentUser.id,
      files,
      currentUser.role,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('images', 10))
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFiles() files: UploadFile[] = [],
    @CurrentUser() currentUser: UserPublic,
  ) {
    const updateProductDto = this.parseUpdateBody(body);
    return this.productsService.update(
      id,
      updateProductDto,
      currentUser.id,
      files,
      currentUser.role,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Validate({
    request: [{ name: 'id', type: 'param', schema: ProductIdParamSchema }],
  })
  remove(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.remove(id, currentUser.id, currentUser.role);
  }
}
