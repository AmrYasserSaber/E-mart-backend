import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async create(createCategoryDto: CreateCategoryDto) {
    const existing = await this.categoryRepository.findOne({
      where: { slug: createCategoryDto.slug },
    });
    if (existing) {
      throw new ConflictException('Category slug already exists');
    }

    const category = this.categoryRepository.create({
      ...createCategoryDto,
      parentId: createCategoryDto.parentId ?? null,
    });
    return this.categoryRepository.save(category);
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

  async update(id: string, updateCategoryDto: UpdateCategoryDto) {
    const category = await this.findOne(id);
    if (updateCategoryDto.slug && updateCategoryDto.slug !== category.slug) {
      const duplicate = await this.categoryRepository.findOne({
        where: { slug: updateCategoryDto.slug },
      });
      if (duplicate) {
        throw new ConflictException('Category slug already exists');
      }
    }
    Object.assign(category, updateCategoryDto);
    if (updateCategoryDto.parentId !== undefined) {
      category.parentId = updateCategoryDto.parentId ?? null;
    }
    return this.categoryRepository.save(category);
  }

  async remove(id: string) {
    const category = await this.findOne(id);
    await this.categoryRepository.remove(category);
    return { message: 'Category deleted successfully' };
  }
}
