import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Request con user (inyectado por JWT o dev bypass) */
interface RequestWithUser {
  user: unknown;
}

/**
 * Inyecta el usuario actual (req.user) en rutas protegidas por JwtAuthGuard.
 * Uso: @CurrentUser() user: UserPayload
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): unknown => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    return request.user;
  },
);
