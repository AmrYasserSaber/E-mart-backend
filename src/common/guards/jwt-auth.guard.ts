import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

/**
 * Placeholder JWT auth guard.
 * Replace with real JWT verification (e.g. passport-jwt) when wiring auth.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean | Promise<boolean> {
    return true;
  }
}
