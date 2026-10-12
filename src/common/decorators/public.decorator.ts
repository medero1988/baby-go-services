import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRE_AUTH_KEY = 'requireAuth';

/**
 * Marca una ruta como pública: no requiere JWT.
 * Usar en controladores del contexto cliente para APIs sin login.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Exige JWT real. No entra el usuario dev del bypass local. */
export const RequireAuth = () => SetMetadata(REQUIRE_AUTH_KEY, true);
