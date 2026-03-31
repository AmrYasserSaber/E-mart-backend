import { Test, TestingModule } from '@nestjs/testing';
import { AddressesController } from './addresses.controller';
import { AddressesService } from './addresses.service';

const USER_ID = 'user-uuid-0000-0000-000000000000';
const ADDRESS_ID = 'addr-uuid-0000-0000-000000000000';

describe('AddressesController', () => {
  let controller: AddressesController;
  let service: jest.Mocked<AddressesService>;

  const mockUser: any = { id: USER_ID };
  const mockAddress: any = {
    id: ADDRESS_ID,
    userId: USER_ID,
    firstName: 'John',
    lastName: 'Doe',
    street: '123 St',
    city: 'City',
    isPrimary: true,
  };

  beforeEach(async () => {
    const mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      setPrimary: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AddressesController],
      providers: [{ provide: AddressesService, useValue: mockService }],
    }).compile();

    controller = module.get<AddressesController>(AddressesController);
    service = module.get(AddressesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.create with dto and userId', async () => {
      const dto = {
        firstName: 'John',
        lastName: 'Doe',
        street: '123 St',
        city: 'City',
      };
      service.create.mockResolvedValue(mockAddress);

      const result = await controller.create(dto, mockUser);

      expect(service.create).toHaveBeenCalledWith(USER_ID, dto);
      expect(result).toEqual(mockAddress);
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with userId', async () => {
      service.findAll.mockResolvedValue({ data: [mockAddress] });

      const result = await controller.findAll(mockUser);

      expect(service.findAll).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ data: [mockAddress] });
    });
  });

  describe('update', () => {
    it('should call service.update with userId and addressId', async () => {
      const dto = { city: 'New City' };
      service.update.mockResolvedValue({ ...mockAddress, ...dto });

      const result = await controller.update(ADDRESS_ID, dto, mockUser);

      expect(service.update).toHaveBeenCalledWith(USER_ID, ADDRESS_ID, dto);
      expect(result.city).toBe('New City');
    });
  });

  describe('setPrimary', () => {
    it('should call service.setPrimary with userId and addressId', async () => {
      service.setPrimary.mockResolvedValue(mockAddress);

      const result = await controller.setPrimary(ADDRESS_ID, mockUser);

      expect(service.setPrimary).toHaveBeenCalledWith(USER_ID, ADDRESS_ID);
      expect(result).toEqual(mockAddress);
    });
  });

  describe('remove', () => {
    it('should call service.remove with userId and addressId', async () => {
      service.remove.mockResolvedValue(undefined);

      const result = await controller.remove(ADDRESS_ID, mockUser);

      expect(service.remove).toHaveBeenCalledWith(USER_ID, ADDRESS_ID);
      expect(result).toEqual(undefined);
    });
  });
});
