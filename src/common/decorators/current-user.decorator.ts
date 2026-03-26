import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Reads `req.user` and injects it into route handlers.
 * If no user is present, returns `undefined`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<{ user?: unknown }>();
    return request?.user;
  },
);
