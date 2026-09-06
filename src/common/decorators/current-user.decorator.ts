import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthUser } from '../../auth/auth-user';

interface RequestWithUser {
  user: AuthUser;
}

/**
 * Inyecta el usuario autenticado (req.user) en rutas protegidas por JwtAuthGuard.
 * Uso: @CurrentUser() user: AuthUser
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
