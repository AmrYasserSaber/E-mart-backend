import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { sign } from 'jsonwebtoken';
import type { Request } from 'express';

describe('JwtAuthGuard', () => {
  const secret = 'test-secret';
  const configService = {
    getOrThrow: jest.fn().mockReturnValue(secret),
  } as unknown as ConfigService;

  const guard = new JwtAuthGuard(configService);

  const createContext = (authorization?: string): ExecutionContext => {
    const request = {
      get: () => authorization,
    } as unknown as Request;

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
  };

  it('throws when authorization header is missing', () => {
    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it('throws when token is invalid', () => {
    expect(() =>
      guard.canActivate(createContext('Bearer invalid-token')),
    ).toThrow(UnauthorizedException);
  });

  it('returns true with valid bearer token', () => {
    const token = sign({ sub: 'user-1', role: 'admin' }, secret);
    expect(guard.canActivate(createContext(`Bearer ${token}`))).toBe(true);
  });
});
