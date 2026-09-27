import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { EnvService } from '../../config/env.service';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../auth-user';
import { AuthService } from '../auth.service';

/** Request con user opcional (inyectado por JWT o dev bypass) */
interface RequestWithUser {
  headers: { authorization?: string; 'x-dev-bypass'?: string };
  user?: AuthUser;
}

/**
 * Guard JWT: exige Bearer token válido.
 * Si la ruta tiene @Public(), no exige auth (para contexto cliente).
 * En local con ENABLE_DEV_AUTH_BYPASS=true: sin token se usa usuario dev (creado si no existe).
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private env: EnvService,
    private authService: AuthService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authHeader = request.headers?.authorization;
    const hasToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ');

    // Bloque de bypass de auth para desarrollo local. El chequeo directo de
    // process.env.NODE_ENV (en vez de this.env.devBypassAuth) es intencional:
    // en el build de producción (nest build --webpack), DefinePlugin inlinea
    // process.env.NODE_ENV como literal y Terser elimina esta rama entera del
    // bundle — el código de bypass no existe en el artefacto de producción.
    if (process.env.NODE_ENV !== 'production') {
      const xDevBypass = request.headers?.['x-dev-bypass'];
      const devBypassHeader = xDevBypass === 'true' || xDevBypass === '1';

      if (
        !hasToken &&
        this.env.devBypassAuth &&
        (devBypassHeader || !authHeader)
      ) {
        const devUser = await this.authService.getOrCreateDevUser();
        if (devUser) {
          request.user = devUser;
          return true;
        }
      }
    }

    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest<TUser>(err: Error | null, user: TUser | false): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or missing token');
    }
    return user;
  }
}
