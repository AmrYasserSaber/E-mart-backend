import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { Payment } from './entities/payment.entity';
import { UserCard } from './entities/user-card.entity';
import { Order } from '../orders/entities/order.entity';
import { KashierProvider } from './providers/kashier.provider';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, UserCard, Order])],
  controllers: [PaymentsController],
  providers: [PaymentsService, KashierProvider],
  exports: [PaymentsService],
})
export class PaymentsModule {}
