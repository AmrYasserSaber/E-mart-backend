import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  Address,
  AddressPublic,
  toAddressPublic,
} from './entities/address.entity';
import {
  CreateAddressBody,
  UpdateAddressBody,
  AddressListResponse,
} from './schemas/address.schemas';

@Injectable()
export class AddressesService {
  private readonly MAX_ADDRESSES = 3;

  constructor(
    @InjectRepository(Address)
    private readonly addressRepository: Repository<Address>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(userId: string): Promise<AddressListResponse> {
    const addresses = await this.addressRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return { data: addresses.map(toAddressPublic) };
  }

  async assertAddressExistsForUser(userId: string, id: string): Promise<void> {
    const exists = await this.addressRepository.existsBy({ id, userId });
    if (!exists) {
      throw new NotFoundException('Address not found');
    }
  }

  async findOne(userId: string, id: string): Promise<AddressPublic> {
    const address = await this.addressRepository.findOne({
      where: { id, userId },
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return toAddressPublic(address);
  }

  async create(userId: string, dto: CreateAddressBody): Promise<AddressPublic> {
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE`, [
        userId,
      ]);

      const count = await manager.count(Address, { where: { userId } });

      if (count >= this.MAX_ADDRESSES) {
        throw new UnprocessableEntityException(
          `User cannot have more than ${this.MAX_ADDRESSES} addresses`,
        );
      }

      const isFirstAddress = count === 0;
      const shouldBePrimary = isFirstAddress || dto.isPrimary;

      if (shouldBePrimary && !isFirstAddress) {
        await manager.update(
          Address,
          { userId, isPrimary: true },
          { isPrimary: false },
        );
      }

      const address = manager.create(Address, {
        ...dto,
        userId,
        isPrimary: shouldBePrimary,
      });

      const saved = await manager.save(address);
      return toAddressPublic(saved);
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAddressBody,
  ): Promise<AddressPublic> {
    const address = await this.addressRepository.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    Object.assign(address, dto);
    const updated = await this.addressRepository.save(address);
    return toAddressPublic(updated);
  }

  async setPrimary(userId: string, id: string): Promise<AddressPublic> {
    return this.dataSource.transaction(async (manager) => {
      const address = await manager.findOne(Address, { where: { id, userId } });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      if (address.isPrimary) {
        return toAddressPublic(address);
      }

      await manager.update(
        Address,
        { userId, isPrimary: true },
        { isPrimary: false },
      );

      address.isPrimary = true;
      const updated = await manager.save(address);

      return toAddressPublic(updated);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    return this.dataSource.transaction(async (manager) => {
      const address = await manager.findOne(Address, { where: { id, userId } });

      if (!address) {
        throw new NotFoundException('Address not found');
      }

      await manager.remove(address);

      if (address.isPrimary) {
        // Auto-promote the most recently created remaining address
        const nextAddress = await manager.findOne(Address, {
          where: { userId },
          order: { createdAt: 'DESC' },
        });

        if (nextAddress) {
          nextAddress.isPrimary = true;
          await manager.save(nextAddress);
        }
      }
    });
  }
}
