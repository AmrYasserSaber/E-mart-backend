import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('oauth_exchange_codes')
export class OAuthExchangeCode {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  userId!: string;

  @Index()
  @Column({ unique: true })
  codeHash!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'varchar', nullable: true })
  returnUrl!: string | null;

  @CreateDateColumn()
  createdAt!: Date;
}
