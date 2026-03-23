import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { Role } from '../../common/enums/role.enum';

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

  @Column()
  passwordHash!: string;

  @Column({ type: 'varchar', default: Role.USER })
  role!: Role;

  @CreateDateColumn()
  createdAt!: Date;
}

export interface UserPublic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  createdAt: string;
}

export function toUserPublic(user: User): UserPublic {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}
