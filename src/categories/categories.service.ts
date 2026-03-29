import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from './schemas/categories.schemas';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  private isSlugUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }

    const driverError = error.driverError as {
      code?: string;
      constraint?: string;
      detail?: string;
    };

    if (driverError.code !== '23505') {
      return false;
    }

    const constraint = driverError.constraint?.toLowerCase() ?? '';
    const detail = driverError.detail?.toLowerCase() ?? '';
    return constraint.includes('slug') || detail.includes('(slug)');
  }

  private async resolveValidParentId(
    parentId: string | null | undefined,
    categoryId?: string,
  ): Promise<string | null | undefined> {
    if (parentId === undefined) {
      return undefined;
    }

    if (parentId === null) {
      return null;
    }

    if (categoryId && parentId === categoryId) {
      throw new BadRequestException('Category cannot be its own parent');
    }

    const parentCategory = await this.categoryRepository.findOne({
      where: { id: parentId },
    });
    if (!parentCategory) {
      throw new BadRequestException('Parent category not found');
    }

    return parentId;
  }

  async create(createCategoryDto: CreateCategoryBody) {
    const validatedParentId = await this.resolveValidParentId(
      createCategoryDto.parentId,
    );

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      parentId: validatedParentId ?? null,
    });
    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (this.isSlugUniqueViolation(error)) {
        throw new ConflictException('Category slug already exists');
      }
      throw error;
    }
  }

  async findAll() {
    return this.categoryRepository.find({
      order: { name: 'ASC' },
    });
  }

  async findOne(id: string) {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, updateCategoryDto: UpdateCategoryBody) {
    const category = await this.findOne(id);
    Object.assign(category, updateCategoryDto);
    if (updateCategoryDto.parentId !== undefined) {
      category.parentId =
        (await this.resolveValidParentId(updateCategoryDto.parentId, id)) ??
        null;
    }
    try {
      return await this.categoryRepository.save(category);
    } catch (error) {
      if (this.isSlugUniqueViolation(error)) {
        throw new ConflictException('Category slug already exists');
      }
      throw error;
    }
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    return { message: 'Category deleted successfully' };
  }
}
