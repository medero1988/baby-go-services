import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca una ruta como pública: no requiere JWT.
 * Usar en controladores del contexto cliente para APIs sin login.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
