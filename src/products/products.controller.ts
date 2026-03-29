import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Query,
  UseGuards,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { ProductsService } from './products.service';
import {
  CreateProductBodySchema,
  ProductFilterQuerySchema,
  ProductIdParamSchema,
  UpdateProductBodySchema,
  type CreateProductBody,
  type ProductFilterQuery,
  type UpdateProductBody,
} from './schemas/products.schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { UserPublic } from '../users/entities/user.entity';
import { ValidateQueryParams } from '../common/decorators/validate-query-params.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
  @Validate({
    request: [
      {
        type: 'body',
        schema: CreateProductBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  create(
    createProductDto: CreateProductBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.create(createProductDto, currentUser.id);
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
  findOne(id: string) {
    return this.productsService.findOne(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
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
  replace(
    id: string,
    updateProductDto: UpdateProductBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.update(id, updateProductDto, currentUser.id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
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
  update(
    id: string,
    updateProductDto: UpdateProductBody,
    @CurrentUser() currentUser: UserPublic,
  ) {
    return this.productsService.update(id, updateProductDto, currentUser.id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @ApiBearerAuth()
  @Validate({
    request: [{ name: 'id', type: 'param', schema: ProductIdParamSchema }],
  })
  remove(id: string, @CurrentUser() currentUser: UserPublic) {
    return this.productsService.remove(id, currentUser.id);
  }
}
