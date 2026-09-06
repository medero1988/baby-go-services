import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Requiere que req.user.role esté en la lista (usar con RolesGuard). */
export const Roles = (...roles: Array<'client' | 'provider'>) =>
  SetMetadata(ROLES_KEY, roles);
