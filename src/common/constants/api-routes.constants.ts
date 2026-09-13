/**
 * Prefijos y versiones de las APIs por contexto.
 * Rutas finales: /api/{version}/...
 */
export const API_VERSION = 'v1';

export const ROUTES = {
  /** Clientes: /api/v1/... */
  CLIENT: `${API_VERSION}`,
  /** Proveedores: /api/v1/... */
  PROVIDER: `${API_VERSION}`,
  /** Configuración común: /api/v1/... */
  COMMON: `${API_VERSION}`,
} as const;
