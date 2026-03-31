import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Address } from '../../addresses/entities/address.entity';
import { User } from '../../users/entities/user.entity';

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export interface OrderProductItem {
  productId: string;
  title: string;
  qty: number;
  price: number;
}
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'jsonb' })
  items!: OrderProductItem[];

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 2,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => Number(value),
    },
  })
  total!: number;

  @Column({ type: 'varchar', default: OrderStatus.PENDING })
  status!: OrderStatus;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  shippingAddressId!: string | null;

  @ManyToOne(() => Address, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shippingAddressId' })
  shippingAddress!: Address | null;

  @Column({ type: 'varchar' })
  paymentMethod!: string;

  @Column({ type: 'varchar', nullable: true })
  paymentIntentId!: string | null;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export interface OrderPublic {
  id: string;
  userId: string;
  items: OrderProductItem[];
  total: number;
  status: OrderStatus;
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  shippingAddressId: string | null;
  paymentIntentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toOrderPublic(order: Order): OrderPublic {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items,
    total: Number(order.total),
    status: order.status,
    shippingAddress: order.shippingAddress,
    paymentMethod: order.paymentMethod,
    shippingAddressId: order.shippingAddressId,
    paymentIntentId: order.paymentIntentId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
