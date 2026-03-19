import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marks a route handler with allowed roles.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

