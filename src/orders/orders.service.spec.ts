import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { Order, OrderStatus } from './entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';
import { AddressesService } from '../addresses/addresses.service';
import { Role } from '../common/enums/role.enum';

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ADDRESS_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ORDER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const PRODUCT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('OrdersService', () => {
  let service: OrdersService;
  let orderRepository: jest.Mocked<Repository<Order>>;
  let cartService: jest.Mocked<CartService>;
  let addressesService: jest.Mocked<AddressesService>;

  const mockOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: ORDER_ID,
      userId: USER_ID,
      items: [
        {
          productId: PRODUCT_ID,
          title: 'Widget',
          qty: 1,
          price: 10,
        },
      ],
      total: 10,
      status: OrderStatus.PENDING,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      updatedAt: new Date('2024-01-01T00:00:00.000Z'),
      shippingAddressId: ADDRESS_ID,
      shippingAddress: null,
      paymentIntentId: null,
      user: {} as Order['user'],
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    const mockOrderRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    };

    const mockPaymentRepository = {
      findOne: jest.fn(),
    };

    const mockProductRepository = {
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockCartService = {
      getCartSummary: jest.fn(),
      clearCart: jest.fn(),
    };

    const mockAddressesService = {
      assertAddressExistsForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: mockOrderRepository,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: mockPaymentRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        { provide: CartService, useValue: mockCartService },
        { provide: AddressesService, useValue: mockAddressesService },
      ],
    }).compile();

    service = module.get(OrdersService);
    orderRepository = module.get(getRepositoryToken(Order));
    cartService = module.get(CartService);
    addressesService = module.get(AddressesService);
  });

  describe('create', () => {
    it('asserts address ownership and persists shippingAddressId from DTO', async () => {
      addressesService.assertAddressExistsForUser.mockResolvedValue(undefined);
      cartService.getCartSummary.mockResolvedValue({
        cartId: 'cart-id',
        items: mockOrder().items,
        total: 10,
      });
      const created = mockOrder();
      orderRepository.create.mockReturnValue(created);
      orderRepository.save.mockResolvedValue(created);

      const actual = await service.create(USER_ID, {
        addressId: ADDRESS_ID,
        paymentMethod: 'CASH_ON_DELIVERY',
      });

      expect(addressesService.assertAddressExistsForUser).toHaveBeenCalledWith(
        USER_ID,
        ADDRESS_ID,
      );
      expect(orderRepository.create).toHaveBeenCalledWith({
        userId: USER_ID,
        items: mockOrder().items,
        total: 10,
        paymentMethod: 'CASH_ON_DELIVERY',
        shippingAddressId: ADDRESS_ID,
        paymentIntentId: null,
      });
      expect(orderRepository.save).toHaveBeenCalledWith(created);
      expect(cartService.clearCart).toHaveBeenCalledWith(USER_ID);
      expect(actual.shippingAddressId).toBe(ADDRESS_ID);
    });

    it('propagates NotFoundException when address is not owned by user', async () => {
      addressesService.assertAddressExistsForUser.mockRejectedValue(
        new NotFoundException('Address not found'),
      );

      await expect(
        service.create(USER_ID, {
          addressId: ADDRESS_ID,
          paymentMethod: 'CASH_ON_DELIVERY',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(orderRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('findOneForUser', () => {
    it('maps shippingAddressId from column without loading relation', async () => {
      const order = mockOrder({ shippingAddress: null });
      orderRepository.findOne.mockResolvedValue(order);

      const actual = await service.findOneForUser(ORDER_ID, USER_ID, Role.USER);

      expect(actual).not.toBeNull();
      expect(actual!.shippingAddressId).toBe(ADDRESS_ID);
    });

    it('returns null when order is missing', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      const actual = await service.findOneForUser(ORDER_ID, USER_ID, Role.USER);

      expect(actual).toBeNull();
    });
  });
});
