import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Product } from '../../products/entities/product.entity';

export enum SellerStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('sellers')
export class Seller {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => User, (user) => user.seller)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ length: 150 })
  storeName!: string;

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'varchar', default: SellerStatus.PENDING })
  status!: SellerStatus;

  @Column({ type: 'float', default: 0 })
  rating!: number;

  @OneToMany(() => Product, (product) => product.seller)
  products!: Product[];

  @CreateDateColumn()
  createdAt!: Date;
}

export interface SellerPublic {
  id: string;
  userId: string;
  storeName: string;
  description: string;
  status: SellerStatus;
  rating: number;
  createdAt: string;
}

export function toSellerPublic(seller: Seller): SellerPublic {
  return {
    id: seller.id,
    userId: seller.userId,
    storeName: seller.storeName,
    description: seller.description,
    status: seller.status,
    rating: seller.rating,
    createdAt: seller.createdAt.toISOString(),
  };
}
