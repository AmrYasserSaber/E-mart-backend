import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  stock!: number;

  @IsUUID()
  categoryId!: string;

  @IsOptional()
  @IsUUID()
  sellerId?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  images!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(5)
  ratingAvg?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(0)
  ratingCount?: number;
}
