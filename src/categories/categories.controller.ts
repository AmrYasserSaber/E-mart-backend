import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  UseGuards,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Validate } from 'nestjs-typebox';
import { CategoriesService } from './categories.service';
import {
  CategoryIdParamSchema,
  CreateCategoryBodySchema,
  UpdateCategoryBodySchema,
  type CreateCategoryBody,
  type UpdateCategoryBody,
} from './schemas/categories.schemas';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Validate({
    request: [
      {
        type: 'body',
        schema: CreateCategoryBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  create(createCategoryDto: CreateCategoryBody) {
    return this.categoriesService.create(createCategoryDto);
  }

  @Get()
  findAll() {
    return this.categoriesService.findAll();
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Validate({
    request: [
      { name: 'id', type: 'param', schema: CategoryIdParamSchema },
      {
        type: 'body',
        schema: UpdateCategoryBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  replace(id: string, updateCategoryDto: UpdateCategoryBody) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Validate({
    request: [
      { name: 'id', type: 'param', schema: CategoryIdParamSchema },
      {
        type: 'body',
        schema: UpdateCategoryBodySchema,
        stripUnknownProps: true,
      },
    ],
  })
  update(id: string, updateCategoryDto: UpdateCategoryBody) {
    return this.categoriesService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @Validate({
    request: [{ name: 'id', type: 'param', schema: CategoryIdParamSchema }],
  })
  remove(id: string) {
    return this.categoriesService.remove(id);
  }
}
