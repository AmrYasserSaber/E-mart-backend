import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('addresses')
@Index('UQ_addresses_user_primary', ['userId'], {
  unique: true,
  where: `"isPrimary" = true`,
})
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user!: User;

  @OneToMany(() => Order, (order) => order.shippingAddress)
  orders!: Order[];

  @Column({ type: 'varchar', length: 50, nullable: true })
  label!: string | null;

  @Column({ type: 'varchar', length: 100 })
  firstName!: string;

  @Column({ type: 'varchar', length: 100 })
  lastName!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ type: 'varchar', length: 200 })
  street!: string;

  @Column({ type: 'varchar', length: 100 })
  city!: string;

  @Column({ type: 'boolean', default: false })
  isPrimary!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

export interface AddressPublic {
  id: string;
  label: string | null;
  firstName: string;
  lastName: string;
  phone: string | null;
  street: string;
  city: string;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export function toAddressPublic(address: Address): AddressPublic {
  return {
    id: address.id,
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    phone: address.phone,
    street: address.street,
    city: address.city,
    isPrimary: address.isPrimary,
    createdAt: address.createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: address.updatedAt?.toISOString() ?? new Date().toISOString(),
  };
}
