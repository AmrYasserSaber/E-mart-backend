import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { OAuthExchangeCode } from '../entities/oauth-exchange-code.entity';
import { env } from '../../config/env';

export interface CreateOAuthExchangeCodeParams {
  readonly userId: string;
  readonly returnUrl: string | null;
}

export interface ConsumeOAuthExchangeCodeResult {
  readonly userId: string;
  readonly returnUrl: string | null;
}

@Injectable()
export class OAuthExchangeCodeService {
  constructor(
    @InjectRepository(OAuthExchangeCode)
    private readonly exchangeCodeRepository: Repository<OAuthExchangeCode>,
    private readonly dataSource: DataSource,
  ) {}

  private hashCode(rawCode: string): string {
    return createHash('sha256').update(rawCode, 'utf8').digest('hex');
  }

  async createExchangeCode(
    params: CreateOAuthExchangeCodeParams,
  ): Promise<string> {
    const rawCode = randomBytes(32).toString('base64url');
    const codeHash = this.hashCode(rawCode);
    const expiresAt = new Date(
      Date.now() + env.OAUTH_EXCHANGE_CODE_TTL_SECONDS * 1000,
    );
    const entity = this.exchangeCodeRepository.create({
      userId: params.userId,
      codeHash,
      expiresAt,
      returnUrl: params.returnUrl,
    });
    await this.exchangeCodeRepository.save(entity);
    return rawCode;
  }

  async consumeExchangeCode(
    rawCode: string,
  ): Promise<ConsumeOAuthExchangeCodeResult> {
    const codeHash = this.hashCode(rawCode);
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(OAuthExchangeCode);
      const existing = await repo.findOne({ where: { codeHash } });
      if (!existing) {
        throw new UnauthorizedException('Invalid OAuth exchange code.');
      }
      if (existing.expiresAt.getTime() <= Date.now()) {
        await repo.delete({ id: existing.id, codeHash });
        throw new UnauthorizedException('OAuth exchange code expired.');
      }
      const deleteResult = await repo.delete({ id: existing.id, codeHash });
      if (deleteResult.affected !== 1) {
        throw new UnauthorizedException('Invalid OAuth exchange code.');
      }
      return { userId: existing.userId, returnUrl: existing.returnUrl };
    });
  }
}
