import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

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

export interface ShippingAddress {
  street: string;
  city: string;
  zip: string;
  country: string;
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

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

  @Column({ type: 'jsonb' })
  shippingAddress!: ShippingAddress;

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
    paymentIntentId: order.paymentIntentId,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
