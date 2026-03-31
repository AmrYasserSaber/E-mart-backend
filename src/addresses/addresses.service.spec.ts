import { Test, TestingModule } from '@nestjs/testing';
import {
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AddressesService } from './addresses.service';
import { Address } from './entities/address.entity';

const USER_ID = 'user-uuid-0000-0000-000000000000';
const ADDRESS_ID = 'addr-uuid-0000-0000-000000000000';
const ADDRESS_ID_2 = 'addr-uuid-1111-1111-111111111111';

describe('AddressesService', () => {
  let service: AddressesService;
  let addressRepository: jest.Mocked<Repository<Address>>;
  let queryRunner: any;

  const mockAddress = (overrides: Partial<Address> = {}): Address =>
    ({
      id: ADDRESS_ID,
      userId: USER_ID,
      label: 'Home',
      firstName: 'John',
      lastName: 'Doe',
      phone: '1234567890',
      street: '123 Main St',
      city: 'Cityville',
      isPrimary: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Address;

  beforeEach(async () => {
    const mockAddressRepository = {
      count: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    queryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        query: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        remove: jest.fn(),
      },
    };

    const mockDataSource = {
      transaction: jest
        .fn()
        .mockImplementation((cb) => cb(queryRunner.manager)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddressesService,
        {
          provide: getRepositoryToken(Address),
          useValue: mockAddressRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<AddressesService>(AddressesService);
    addressRepository = module.get(getRepositoryToken(Address));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create an address and set as primary if it is the first one', async () => {
      queryRunner.manager.query.mockResolvedValue([]);
      queryRunner.manager.count.mockResolvedValue(0);
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 St',
        city: 'City',
      };
      const created = mockAddress({ isPrimary: true });
      queryRunner.manager.create.mockReturnValue(created);
      queryRunner.manager.save.mockResolvedValue(created);

      const result = await service.create(USER_ID, dto);

      expect(queryRunner.manager.query).toHaveBeenCalledWith(
        `SELECT 1 FROM "users" WHERE "id" = $1 FOR UPDATE`,
        [USER_ID],
      );
      expect(queryRunner.manager.count).toHaveBeenCalledWith(Address, {
        where: { userId: USER_ID },
      });
      expect(queryRunner.manager.create).toHaveBeenCalledWith(Address, {
        ...dto,
        userId: USER_ID,
        isPrimary: true,
      });
      expect(queryRunner.manager.save).toHaveBeenCalledWith(created);
      expect(result.isPrimary).toBe(true);
    });

    it('should throw BadRequestException if limit is reached', async () => {
      queryRunner.manager.query.mockResolvedValue([]);
      queryRunner.manager.count.mockResolvedValue(3);
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 St',
        city: 'City',
      };

      await expect(service.create(USER_ID, dto)).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('setPrimary', () => {
    it('should update primary statuses transactionally', async () => {
      const address = mockAddress({ id: ADDRESS_ID, isPrimary: false });
      queryRunner.manager.findOne.mockResolvedValue(address);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });
      queryRunner.manager.save.mockResolvedValue({
        ...address,
        isPrimary: true,
      });

      const result = await service.setPrimary(USER_ID, ADDRESS_ID);

      expect(queryRunner.manager.update).toHaveBeenCalledWith(
        Address,
        { userId: USER_ID, isPrimary: true },
        { isPrimary: false },
      );
      expect(queryRunner.manager.save).toHaveBeenCalled();
      expect(result.id).toBe(ADDRESS_ID);
    });

    it('should throw NotFoundException if address not found', async () => {
      queryRunner.manager.findOne.mockResolvedValue(null);
      await expect(service.setPrimary(USER_ID, ADDRESS_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('should remove non-primary address directly', async () => {
      const address = mockAddress({ id: ADDRESS_ID, isPrimary: false });
      queryRunner.manager.findOne.mockResolvedValue(address);
      queryRunner.manager.remove.mockResolvedValue(address);

      await service.remove(USER_ID, ADDRESS_ID);

      expect(queryRunner.manager.remove).toHaveBeenCalledWith(address);
      expect(queryRunner.manager.update).not.toHaveBeenCalled();
    });

    it('should auto-promote latest address when removing primary', async () => {
      const address = mockAddress({ id: ADDRESS_ID, isPrimary: true });
      const latestAddress = mockAddress({ id: ADDRESS_ID_2, isPrimary: false });

      queryRunner.manager.findOne
        .mockResolvedValueOnce(address)
        .mockResolvedValueOnce(latestAddress);
      queryRunner.manager.remove.mockResolvedValue(address);
      queryRunner.manager.update.mockResolvedValue({ affected: 1 });

      await service.remove(USER_ID, ADDRESS_ID);

      expect(queryRunner.manager.remove).toHaveBeenCalledWith(address);
      expect(queryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: latestAddress.id, isPrimary: true }),
      );
    });
  });
});
