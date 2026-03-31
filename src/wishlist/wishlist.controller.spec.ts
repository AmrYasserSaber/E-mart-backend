import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';
import { WishlistItem } from './entities/wishlist-item.entity';
import { UserPublic } from '../users/entities/user.entity';
import { Role } from '../common/enums/role.enum';

const PRODUCT_ID_1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_ID_2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const USER_ID = 'user-uuid-0000-0000-000000000000';

const mockCurrentUser: UserPublic = {
  id: USER_ID,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  role: Role.USER,
  createdAt: new Date('2024-01-01').toISOString(),
};

const mockWishlistItem = (productId = PRODUCT_ID_1): WishlistItem =>
  ({
    id: 'item-uuid',
    userId: USER_ID,
    productId,
    addedAt: new Date('2024-01-01'),
  }) as WishlistItem;

describe('WishlistController', () => {
  let controller: WishlistController;
  let wishlistService: jest.Mocked<WishlistService>;

  beforeEach(async () => {
    const mockWishlistService = {
      getWishlist: jest.fn(),
      addItem: jest.fn(),
      bulkAddItems: jest.fn(),
      removeItem: jest.fn(),
      clearWishlist: jest.fn(),
      isInWishlist: jest.fn(),
      getWishlistProductIds: jest.fn(),
      getCount: jest.fn(),
      moveToCart: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WishlistController],
      providers: [{ provide: WishlistService, useValue: mockWishlistService }],
    }).compile();

    controller = module.get<WishlistController>(WishlistController);
    wishlistService = module.get(WishlistService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ─── getWishlist ──────────────────────────────────────────────────────────

  describe('getWishlist', () => {
    it('should delegate to service with provided page and limit', async () => {
      const paginatedResult = {
        data: [mockWishlistItem()],
        total: 1,
        page: 1,
        pages: 1,
      };
      wishlistService.getWishlist.mockResolvedValue(paginatedResult);

      const result = await controller.getWishlist(
        { page: 1, limit: 10 },
        mockCurrentUser,
      );

      expect(wishlistService.getWishlist).toHaveBeenCalledWith(USER_ID, 1, 10);
      expect(result).toEqual(paginatedResult);
    });

    it('should pass undefined page/limit when query params are omitted', async () => {
      wishlistService.getWishlist.mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        pages: 1,
      });

      await controller.getWishlist({}, mockCurrentUser);

      expect(wishlistService.getWishlist).toHaveBeenCalledWith(
        USER_ID,
        undefined,
        undefined,
      );
    });
  });

  // ─── getWishlistProductIds ────────────────────────────────────────────────

  describe('getWishlistProductIds', () => {
    it('should return product IDs from service', async () => {
      wishlistService.getWishlistProductIds.mockResolvedValue({
        productIds: [PRODUCT_ID_1, PRODUCT_ID_2],
      });

      const result = await controller.getWishlistProductIds(mockCurrentUser);

      expect(wishlistService.getWishlistProductIds).toHaveBeenCalledWith(
        USER_ID,
      );
      expect(result).toEqual({ productIds: [PRODUCT_ID_1, PRODUCT_ID_2] });
    });

    it('should return empty array when wishlist is empty', async () => {
      wishlistService.getWishlistProductIds.mockResolvedValue({
        productIds: [],
      });

      const result = await controller.getWishlistProductIds(mockCurrentUser);

      expect(result).toEqual({ productIds: [] });
    });
  });

  // ─── getCount ─────────────────────────────────────────────────────────────

  describe('getCount', () => {
    it('should return count from service', async () => {
      wishlistService.getCount.mockResolvedValue({ count: 7 });

      const result = await controller.getCount(mockCurrentUser);

      expect(wishlistService.getCount).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ count: 7 });
    });

    it('should return count=0 for empty wishlist', async () => {
      wishlistService.getCount.mockResolvedValue({ count: 0 });

      const result = await controller.getCount(mockCurrentUser);

      expect(result).toEqual({ count: 0 });
    });
  });

  // ─── isInWishlist ─────────────────────────────────────────────────────────

  describe('isInWishlist', () => {
    it('should return true when product is in wishlist', async () => {
      wishlistService.isInWishlist.mockResolvedValue({ inWishlist: true });

      const result = await controller.isInWishlist(
        PRODUCT_ID_1,
        mockCurrentUser,
      );

      expect(wishlistService.isInWishlist).toHaveBeenCalledWith(
        USER_ID,
        PRODUCT_ID_1,
      );
      expect(result).toEqual({ inWishlist: true });
    });

    it('should return false when product is not in wishlist', async () => {
      wishlistService.isInWishlist.mockResolvedValue({ inWishlist: false });

      const result = await controller.isInWishlist(
        PRODUCT_ID_1,
        mockCurrentUser,
      );

      expect(result).toEqual({ inWishlist: false });
    });
  });

  // ─── addItem ──────────────────────────────────────────────────────────────

  describe('addItem', () => {
    it('should add item and return the wishlist item', async () => {
      const item = mockWishlistItem();
      wishlistService.addItem.mockResolvedValue(item);

      const result = await controller.addItem(
        { productId: PRODUCT_ID_1 },
        mockCurrentUser,
      );

      expect(wishlistService.addItem).toHaveBeenCalledWith(
        USER_ID,
        PRODUCT_ID_1,
      );
      expect(result).toEqual(item);
    });

    it('should return existing item when product is already wishlisted', async () => {
      const existing = mockWishlistItem();
      wishlistService.addItem.mockResolvedValue(existing);

      const result = await controller.addItem(
        { productId: PRODUCT_ID_1 },
        mockCurrentUser,
      );

      expect(result).toEqual(existing);
    });

    it('should propagate NotFoundException when product does not exist', async () => {
      wishlistService.addItem.mockRejectedValue(
        new NotFoundException('Product not found'),
      );

      await expect(
        controller.addItem({ productId: PRODUCT_ID_1 }, mockCurrentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── bulkAddItems ─────────────────────────────────────────────────────────

  describe('bulkAddItems', () => {
    it('should return added/skipped counts from service', async () => {
      wishlistService.bulkAddItems.mockResolvedValue({ added: 2, skipped: 0 });

      const result = await controller.bulkAddItems(
        { productIds: [PRODUCT_ID_1, PRODUCT_ID_2] },
        mockCurrentUser,
      );

      expect(wishlistService.bulkAddItems).toHaveBeenCalledWith(USER_ID, [
        PRODUCT_ID_1,
        PRODUCT_ID_2,
      ]);
      expect(result).toEqual({ added: 2, skipped: 0 });
    });

    it('should propagate NotFoundException when any product does not exist', async () => {
      wishlistService.bulkAddItems.mockRejectedValue(
        new NotFoundException('Products not found: nonexistent-id'),
      );

      await expect(
        controller.bulkAddItems(
          { productIds: [PRODUCT_ID_1] },
          mockCurrentUser,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── moveToCart ───────────────────────────────────────────────────────────

  describe('moveToCart', () => {
    it('should call service and resolve without error', async () => {
      wishlistService.moveToCart.mockResolvedValue(undefined);

      await controller.moveToCart(PRODUCT_ID_1, mockCurrentUser);

      expect(wishlistService.moveToCart).toHaveBeenCalledWith(
        USER_ID,
        PRODUCT_ID_1,
      );
    });

    it('should propagate NotFoundException when product is not in wishlist', async () => {
      wishlistService.moveToCart.mockRejectedValue(
        new NotFoundException('Product not in wishlist'),
      );

      await expect(
        controller.moveToCart(PRODUCT_ID_1, mockCurrentUser),
      ).rejects.toThrow(new NotFoundException('Product not in wishlist'));
    });
  });

  // ─── removeItem ───────────────────────────────────────────────────────────

  describe('removeItem', () => {
    it('should call service and resolve without error', async () => {
      wishlistService.removeItem.mockResolvedValue(undefined);

      await controller.removeItem(PRODUCT_ID_1, mockCurrentUser);

      expect(wishlistService.removeItem).toHaveBeenCalledWith(
        USER_ID,
        PRODUCT_ID_1,
      );
    });

    it('should propagate NotFoundException when item is not in wishlist', async () => {
      wishlistService.removeItem.mockRejectedValue(
        new NotFoundException('Product not in wishlist'),
      );

      await expect(
        controller.removeItem(PRODUCT_ID_1, mockCurrentUser),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── clearWishlist ────────────────────────────────────────────────────────

  describe('clearWishlist', () => {
    it('should return deleted count from service', async () => {
      wishlistService.clearWishlist.mockResolvedValue({ deleted: 4 });

      const result = await controller.clearWishlist(mockCurrentUser);

      expect(wishlistService.clearWishlist).toHaveBeenCalledWith(USER_ID);
      expect(result).toEqual({ deleted: 4 });
    });

    it('should return deleted=0 when wishlist was already empty', async () => {
      wishlistService.clearWishlist.mockResolvedValue({ deleted: 0 });

      const result = await controller.clearWishlist(mockCurrentUser);

      expect(result).toEqual({ deleted: 0 });
    });
  });
});
