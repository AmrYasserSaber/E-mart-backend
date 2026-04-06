import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';
import { AuthProvider } from '../../common/enums/auth-provider.enum';
import { Seller } from '../../sellers/entities/seller.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  firstName!: string;

  @Column()
  lastName!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'varchar', default: AuthProvider.LOCAL })
  authProvider!: AuthProvider;

  @Column({ type: 'varchar', nullable: true, unique: true })
  googleId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', default: Role.USER })
  role!: Role;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ default: true })
  active!: boolean;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ type: 'varchar', nullable: true })
  emailVerificationCodeHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerificationExpiresAt!: Date | null;
  @OneToOne(() => Seller, (seller) => seller.user)
  seller?: Seller;
}

export interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  active: boolean;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export function toUserPublic(user: User): UserPublic {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    active: user.active,
    emailVerifiedAt: user.emailVerifiedAt
      ? user.emailVerifiedAt.toISOString()
      : null,
    createdAt: user.createdAt
      ? user.createdAt.toISOString()
      : new Date(0).toISOString(),
  };
}
