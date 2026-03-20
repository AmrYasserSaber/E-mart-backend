import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { CategoriesModule } from './categories/categories.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CartModule } from './cart/cart.module';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { SellersModule } from './sellers/sellers.module';
import { AdminModule } from './admin/admin.module';
import { MailModule } from './mail/mail.module';
import { UploadModule } from './upload/upload.module';
import { databaseConfig } from './config/database.config';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    ProductsModule,
    CategoriesModule,
    ReviewsModule,
    CartModule,
    PaymentsModule,
    OrdersModule,
    SellersModule,
    AdminModule,
    MailModule,
    UploadModule,
    TypeOrmModule.forRootAsync({ useFactory: databaseConfig }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
