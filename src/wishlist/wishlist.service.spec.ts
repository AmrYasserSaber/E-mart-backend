import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WishlistService } from './wishlist.service';
import { WishlistItem } from './entities/wishlist-item.entity';
import { Product } from '../products/entities/product.entity';
import { CartService } from '../cart/cart.service';

const PRODUCT_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PRODUCT_ID_3 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const USER_ID = 'user-uuid-0000-0000-000000000000';
const ITEM_ID = 'item-uuid-0000-0000-000000000000';

describe('WishlistService', () => {
  let service: WishlistService;
  let wishlistItemRepository: jest.Mocked<Repository<WishlistItem>>;
  let productRepository: jest.Mocked<Repository<Product>>;
  let cartService: jest.Mocked<CartService>;

  const mockProduct = (id: string): Partial<Product> => ({ id });

  const mockWishlistItem = (productId = PRODUCT_ID_1): WishlistItem =>
    ({
      id: ITEM_ID,
      userId: USER_ID,
      productId,
      addedAt: new Date('2024-01-01'),
    }) as WishlistItem;

  beforeEach(async () => {
    const mockWishlistItemRepository = {
      findAndCount: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
      remove: jest.fn(),
      existsBy: jest.fn(),
      countBy: jest.fn(),
    };

    const mockProductRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockCartService = {
      addItem: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WishlistService,
        {
          provide: getRepositoryToken(WishlistItem),
          useValue: mockWishlistItemRepository,
        },
        {
          provide: getRepositoryToken(Product),
          useValue: mockProductRepository,
        },
        { provide: CartService, useValue: mockCartService },
      ],
    }).compile();

    service = module.get<WishlistService>(WishlistService);
    wishlistItemRepository = module.get(getRepositoryToken(WishlistItem));
    productRepository = module.get(getRepositoryToken(Product));
    cartService = module.get(CartService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getWishlist ──────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('should return a paginated result with items', async () => {
      const items = [mockWishlistItem()];
      wishlistItemRepository.findAndCount.mockResolvedValue([items, 1]);

      const result = await service.getWishlist(USER_ID, 1, 20);

      expect(wishlistItemRepository.findAndCount).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        relations: ['product', 'product.category'],
        order: { addedAt: 'DESC' },
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({ data: items, total: 1, page: 1, pages: 1 });
    });

    it('should use default page and limit when omitted', async () => {
      wishlistItemRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.getWishlist(USER_ID);

      expect(wishlistItemRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20 }),
      );
    });

    it('should calculate correct skip for page 2', async () => {
      wishlistItemRepository.findAndCount.mockResolvedValue([[], 25]);

      const result = await service.getWishlist(USER_ID, 2, 10);

      expect(wishlistItemRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
      expect(result.pages).toBe(3);
    });

    it('should return pages=1 when there are no items', async () => {
      wishlistItemRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getWishlist(USER_ID, 1, 20);

      expect(result).toEqual({ data: [], total: 0, page: 1, pages: 1 });
    });

    it('should return an empty wishlist for a user who has no items', async () => {
      wishlistItemRepository.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.getWishlist('unknown-user');

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should create and return a new wishlist item', async () => {
      const item = mockWishlistItem();
      productRepository.findOne.mockResolvedValue(
        mockProduct(PRODUCT_ID_1) as Product,
      );
      wishlistItemRepository.findOne.mockResolvedValue(null);
      wishlistItemRepository.create.mockReturnValue(item);
      wishlistItemRepository.save.mockResolvedValue(item);

      const result = await service.addItem(USER_ID, PRODUCT_ID_1);

      expect(productRepository.findOne).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID_1 },
      });
      expect(wishlistItemRepository.create).toHaveBeenCalledWith({
        userId: USER_ID,
        productId: PRODUCT_ID_1,
      });
      expect(wishlistItemRepository.save).toHaveBeenCalledWith(item);
      expect(result).toEqual(item);
    });

    it('should return existing item without saving when product is already wishlisted (idempotent)', async () => {
      const existing = mockWishlistItem();
      productRepository.findOne.mockResolvedValue(
        mockProduct(PRODUCT_ID_1) as Product,
      );
      wishlistItemRepository.findOne.mockResolvedValue(existing);

      const result = await service.addItem(USER_ID, PRODUCT_ID_1);

      expect(wishlistItemRepository.create).not.toHaveBeenCalled();
      expect(wishlistItemRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existing);
    });

    it('should throw NotFoundException when product does not exist', async () => {
      productRepository.findOne.mockResolvedValue(null);

      await expect(service.addItem(USER_ID, 'nonexistent-id')).rejects.toThrow(
        new NotFoundException('Product not found'),
      );

      expect(wishlistItemRepository.findOne).not.toHaveBeenCalled();
      expect(wishlistItemRepository.save).not.toHaveBeenCalled();
    });
  });

  // ─── bulkAddItems ─────────────────────────────────────────────────────────

  describe('bulkAddItems', () => {
    it('should add all new products when none are already in wishlist', async () => {
      const ids = [PRODUCT_ID_1, PRODUCT_ID_2];
      productRepository.find.mockResolvedValue(
        ids.map((id) => mockProduct(id)) as Product[],
      );
      wishlistItemRepository.find.mockResolvedValue([]);
      wishlistItemRepository.create.mockImplementation(
        (data) => data as WishlistItem,
      );
      wishlistItemRepository.save.mockResolvedValue(
        [] as unknown as WishlistItem,
      );

      const result = await service.bulkAddItems(USER_ID, ids);

      expect(wishlistItemRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ added: 2, skipped: 0 });
    });

    it('should skip products already in the wishlist', async () => {
      const ids = [PRODUCT_ID_1, PRODUCT_ID_2];
      productRepository.find.mockResolvedValue(
        ids.map((id) => mockProduct(id)) as Product[],
      );
      wishlistItemRepository.find.mockResolvedValue([
        { productId: PRODUCT_ID_1 } as WishlistItem,
      ]);
      wishlistItemRepository.create.mockImplementation(
        (data) => data as WishlistItem,
      );
      wishlistItemRepository.save.mockResolvedValue(
        [] as unknown as WishlistItem,
      );

      const result = await service.bulkAddItems(USER_ID, ids);

      expect(result).toEqual({ added: 1, skipped: 1 });
    });

    it('should skip save call when all products are already in the wishlist', async () => {
      const ids = [PRODUCT_ID_1];
      productRepository.find.mockResolvedValue([
        mockProduct(PRODUCT_ID_1),
      ] as Product[]);
      wishlistItemRepository.find.mockResolvedValue([
        { productId: PRODUCT_ID_1 } as WishlistItem,
      ]);

      const result = await service.bulkAddItems(USER_ID, ids);

      expect(wishlistItemRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual({ added: 0, skipped: 1 });
    });

    it('should deduplicate product IDs before processing', async () => {
      productRepository.find.mockResolvedValue([
        mockProduct(PRODUCT_ID_1),
      ] as Product[]);
      wishlistItemRepository.find.mockResolvedValue([]);
      wishlistItemRepository.create.mockImplementation(
        (data) => data as WishlistItem,
      );
      wishlistItemRepository.save.mockResolvedValue(
        [] as unknown as WishlistItem,
      );

      const result = await service.bulkAddItems(USER_ID, [
        PRODUCT_ID_1,
        PRODUCT_ID_1,
      ]);

      expect(productRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({}),
        }),
      );
      expect(result).toEqual({ added: 1, skipped: 0 });
    });

    it('should throw NotFoundException when any product does not exist', async () => {
      productRepository.find.mockResolvedValue([
        mockProduct(PRODUCT_ID_1),
      ] as Product[]);

      await expect(
        service.bulkAddItems(USER_ID, [PRODUCT_ID_1, PRODUCT_ID_2]),
      ).rejects.toThrow(NotFoundException);

      expect(wishlistItemRepository.save).not.toHaveBeenCalled();
    });

    it('should include the missing product IDs in the error message', async () => {
      productRepository.find.mockResolvedValue([]);

      await expect(
        service.bulkAddItems(USER_ID, [PRODUCT_ID_1, PRODUCT_ID_2]),
      ).rejects.toThrow(`Products not found: ${PRODUCT_ID_1}, ${PRODUCT_ID_2}`);
    });

    it('should add all products when the list has exactly 1 item', async () => {
      productRepository.find.mockResolvedValue([
        mockProduct(PRODUCT_ID_1),
      ] as Product[]);
      wishlistItemRepository.find.mockResolvedValue([]);
      wishlistItemRepository.create.mockImplementation(
        (data) => data as WishlistItem,
      );
      wishlistItemRepository.save.mockResolvedValue({} as WishlistItem);

      const result = await service.bulkAddItems(USER_ID, [PRODUCT_ID_1]);

      expect(result).toEqual({ added: 1, skipped: 0 });
    });

    it('should handle mix of new and already-wishlisted products', async () => {
      const ids = [PRODUCT_ID_1, PRODUCT_ID_2, PRODUCT_ID_3];
      productRepository.find.mockResolvedValue(
        ids.map((id) => mockProduct(id)) as Product[],
      );
      wishlistItemRepository.find.mockResolvedValue([
        { productId: PRODUCT_ID_1 } as WishlistItem,
        { productId: PRODUCT_ID_3 } as WishlistItem,
      ]);
      wishlistItemRepository.create.mockImplementation(
        (data) => data as WishlistItem,
      );
      wishlistItemRepository.save.mockResolvedValue({} as WishlistItem);

      const result = await service.bulkAddItems(USER_ID, ids);

      expect(result).toEqual({ added: 1, skipped: 2 });
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should delete the item when it exists', async () => {
      wishlistItemRepository.delete.mockResolvedValue({ affected: 1, raw: [] });

      await service.removeItem(USER_ID, PRODUCT_ID_1);

      expect(wishlistItemRepository.delete).toHaveBeenCalledWith({
        userId: USER_ID,
        productId: PRODUCT_ID_1,
      });
    });

    it('should throw NotFoundException when item is not in the wishlist', async () => {
      wishlistItemRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(service.removeItem(USER_ID, PRODUCT_ID_1)).rejects.toThrow(
        new NotFoundException('Product not in wishlist'),
      );
    });
  });

  // ─── clearWishlist ────────────────────────────────────────────────────────

  describe('clearWishlist', () => {
    it('should delete all items for the user and return the count', async () => {
      wishlistItemRepository.delete.mockResolvedValue({ affected: 3, raw: [] });

      const result = await service.clearWishlist(USER_ID);

      expect(wishlistItemRepository.delete).toHaveBeenCalledWith({
        userId: USER_ID,
      });
      expect(result).toEqual({ deleted: 3 });
    });

    it('should return deleted=0 when the wishlist is already empty', async () => {
      wishlistItemRepository.delete.mockResolvedValue({ affected: 0, raw: [] });

      const result = await service.clearWishlist(USER_ID);

      expect(result).toEqual({ deleted: 0 });
    });

    it('should return deleted=0 when affected is null/undefined', async () => {
      wishlistItemRepository.delete.mockResolvedValue({
        affected: undefined,
        raw: [],
      });

      const result = await service.clearWishlist(USER_ID);

      expect(result).toEqual({ deleted: 0 });
    });
  });

  // ─── isInWishlist ─────────────────────────────────────────────────────────

  describe('isInWishlist', () => {
    it('should return { inWishlist: true } when product is wishlisted', async () => {
      wishlistItemRepository.existsBy.mockResolvedValue(true);

      const result = await service.isInWishlist(USER_ID, PRODUCT_ID_1);

      expect(wishlistItemRepository.existsBy).toHaveBeenCalledWith({
        userId: USER_ID,
        productId: PRODUCT_ID_1,
      });
      expect(result).toEqual({ inWishlist: true });
    });

    it('should return { inWishlist: false } when product is not wishlisted', async () => {
      wishlistItemRepository.existsBy.mockResolvedValue(false);

      const result = await service.isInWishlist(USER_ID, PRODUCT_ID_1);

      expect(result).toEqual({ inWishlist: false });
    });
  });

  // ─── getWishlistProductIds ────────────────────────────────────────────────

  describe('getWishlistProductIds', () => {
    it('should return all product IDs in the wishlist ordered newest first', async () => {
      wishlistItemRepository.find.mockResolvedValue([
        { productId: PRODUCT_ID_2 } as WishlistItem,
        { productId: PRODUCT_ID_1 } as WishlistItem,
      ]);

      const result = await service.getWishlistProductIds(USER_ID);

      expect(wishlistItemRepository.find).toHaveBeenCalledWith({
        where: { userId: USER_ID },
        select: ['productId'],
        order: { addedAt: 'DESC' },
      });
      expect(result).toEqual({ productIds: [PRODUCT_ID_2, PRODUCT_ID_1] });
    });

    it('should return an empty array when wishlist is empty', async () => {
      wishlistItemRepository.find.mockResolvedValue([]);

      const result = await service.getWishlistProductIds(USER_ID);

      expect(result).toEqual({ productIds: [] });
    });
  });

  // ─── getCount ─────────────────────────────────────────────────────────────

  describe('getCount', () => {
    it('should return the number of items in the wishlist', async () => {
      wishlistItemRepository.countBy.mockResolvedValue(5);

      const result = await service.getCount(USER_ID);

      expect(wishlistItemRepository.countBy).toHaveBeenCalledWith({
        userId: USER_ID,
      });
      expect(result).toEqual({ count: 5 });
    });

    it('should return count=0 for an empty wishlist', async () => {
      wishlistItemRepository.countBy.mockResolvedValue(0);

      const result = await service.getCount(USER_ID);

      expect(result).toEqual({ count: 0 });
    });
  });

  // ─── moveToCart ───────────────────────────────────────────────────────────

  describe('moveToCart', () => {
    it('should add to cart and remove from wishlist', async () => {
      const item = mockWishlistItem();
      wishlistItemRepository.findOne.mockResolvedValue(item);
      cartService.addItem.mockResolvedValue(undefined as never);
      wishlistItemRepository.remove.mockResolvedValue(item);

      await service.moveToCart(USER_ID, PRODUCT_ID_1);

      expect(wishlistItemRepository.findOne).toHaveBeenCalledWith({
        where: { userId: USER_ID, productId: PRODUCT_ID_1 },
      });
      expect(cartService.addItem).toHaveBeenCalledWith(USER_ID, {
        productId: PRODUCT_ID_1,
        quantity: 1,
      });
      expect(wishlistItemRepository.remove).toHaveBeenCalledWith(item);
    });

    it('should throw NotFoundException when product is not in wishlist', async () => {
      wishlistItemRepository.findOne.mockResolvedValue(null);

      await expect(service.moveToCart(USER_ID, PRODUCT_ID_1)).rejects.toThrow(
        new NotFoundException('Product not in wishlist'),
      );

      expect(cartService.addItem).not.toHaveBeenCalled();
      expect(wishlistItemRepository.remove).not.toHaveBeenCalled();
    });

    it('should not remove from wishlist if cartService.addItem throws', async () => {
      const item = mockWishlistItem();
      wishlistItemRepository.findOne.mockResolvedValue(item);
      cartService.addItem.mockRejectedValue(new Error('Cart error'));

      await expect(service.moveToCart(USER_ID, PRODUCT_ID_1)).rejects.toThrow(
        'Cart error',
      );

      expect(wishlistItemRepository.remove).not.toHaveBeenCalled();
    });

    it('should always use quantity 1 when moving to cart', async () => {
      const item = mockWishlistItem();
      wishlistItemRepository.findOne.mockResolvedValue(item);
      cartService.addItem.mockResolvedValue(undefined as never);
      wishlistItemRepository.remove.mockResolvedValue(item);

      await service.moveToCart(USER_ID, PRODUCT_ID_1);

      expect(cartService.addItem).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ quantity: 1 }),
      );
    });
  });
});
