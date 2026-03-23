import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from './entities/user.entity';
import { Role } from '../common/enums/role.enum';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  async create(
    firstName: string,
    lastName: string,
    email: string,
    plainPassword: string,
    role: Role = Role.USER,
  ): Promise<User> {
    const normalizedEmail = this.normalizeEmail(email);
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    const user = this.userRepository.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });
    return this.userRepository.save(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.userRepository.findOne({ where: { email: normalizedEmail } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async validatePassword(user: User, plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, user.passwordHash);
  }
}
