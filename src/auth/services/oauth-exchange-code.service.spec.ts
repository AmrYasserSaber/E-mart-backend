import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, type Repository } from 'typeorm';
import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { OAuthExchangeCodeService } from './oauth-exchange-code.service';
import { OAuthExchangeCode } from '../entities/oauth-exchange-code.entity';

function hashCode(rawCode: string): string {
  return createHash('sha256').update(rawCode, 'utf8').digest('hex');
}

describe('OAuthExchangeCodeService', () => {
  let service: OAuthExchangeCodeService;
  let exchangeCodeRepository: jest.Mocked<Repository<OAuthExchangeCode>>;
  let dataSource: jest.Mocked<DataSource>;

  beforeEach(async () => {
    const mockRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };
    const mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthExchangeCodeService,
        { provide: getRepositoryToken(OAuthExchangeCode), useValue: mockRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get(OAuthExchangeCodeService);
    exchangeCodeRepository = module.get(getRepositoryToken(OAuthExchangeCode));
    dataSource = module.get(DataSource);
  });

  describe('executeCreateExchangeCode', () => {
    it('creates and persists a new exchange code', async () => {
      exchangeCodeRepository.create.mockImplementation((x) => x as never);
      exchangeCodeRepository.save.mockResolvedValue({} as never);

      const actualCode = await service.createExchangeCode({
        userId: 'user-1',
        returnUrl: '/profile',
      });

      expect(actualCode).toEqual(expect.any(String));
      expect(exchangeCodeRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          returnUrl: '/profile',
          codeHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
      expect(exchangeCodeRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeConsumeExchangeCode', () => {
    it('consumes a valid code once', async () => {
      const rawCode = 'raw-code';
      const codeHash = hashCode(rawCode);
      const nowPlus = new Date(Date.now() + 60_000);

      const transactionalRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'id-1',
          userId: 'user-1',
          codeHash,
          expiresAt: nowPlus,
          returnUrl: '/profile',
        }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      dataSource.transaction.mockImplementation(((callback: unknown) => {
        return (callback as (m: unknown) => unknown)({
          getRepository: () => transactionalRepo,
        });
      }) as never);

      const result = await service.consumeExchangeCode(rawCode);

      expect(result).toEqual({ userId: 'user-1', returnUrl: '/profile' });
      expect(transactionalRepo.findOne).toHaveBeenCalledWith({
        where: { codeHash },
      });
      expect(transactionalRepo.delete).toHaveBeenCalledWith({
        id: 'id-1',
        codeHash,
      });
    });

    it('rejects unknown code', async () => {
      const transactionalRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      dataSource.transaction.mockImplementation(((callback: unknown) => {
        return (callback as (m: unknown) => unknown)({
          getRepository: () => transactionalRepo,
        });
      }) as never);

      await expect(service.consumeExchangeCode('missing')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects expired code', async () => {
      const rawCode = 'expired';
      const codeHash = hashCode(rawCode);

      const transactionalRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'id-1',
          userId: 'user-1',
          codeHash,
          expiresAt: new Date(Date.now() - 1),
          returnUrl: null,
        }),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      dataSource.transaction.mockImplementation(((callback: unknown) => {
        return (callback as (m: unknown) => unknown)({
          getRepository: () => transactionalRepo,
        });
      }) as never);

      await expect(service.consumeExchangeCode(rawCode)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(transactionalRepo.delete).toHaveBeenCalledTimes(1);
    });
  });
});
