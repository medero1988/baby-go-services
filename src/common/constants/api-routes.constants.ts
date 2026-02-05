/**
 * Prefijos y versiones de las APIs por contexto.
 * Rutas finales: /api/{context}/{version}/...
 */
export const API_VERSION = 'v1';

export const ROUTES = {
  /** Clientes: /api/c/v1/... */
  CLIENT: `c/${API_VERSION}`,
  /** Proveedores: /api/p/v1/... */
  PROVIDER: `p/${API_VERSION}`,
} as const;
