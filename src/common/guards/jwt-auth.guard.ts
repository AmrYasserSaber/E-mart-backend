import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Passport-backed JWT guard.
 *
 * Uses `JwtStrategy` to validate the token and attaches a validated user object
 * to `req.user`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
