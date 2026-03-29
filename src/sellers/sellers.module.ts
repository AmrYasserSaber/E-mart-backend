import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellersService } from './sellers.service';
import { SellersController } from './sellers.controller';
import { Seller } from './entities/seller.entity';
import { User } from '../users/entities/user.entity';
import { ProductsModule } from '../products/products.module';
import { Product } from '../products/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Seller, User, Product]), ProductsModule],
  controllers: [SellersController],
  providers: [SellersService],
})
export class SellersModule {}
