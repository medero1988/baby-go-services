export type ProductPrice = {
  /** Precio lista por día. */
  list: number;
  /** Precio oferta por día (opcional). */
  offer?: number;
  /** Inicio vigencia oferta (ISO date). */
  activeFrom?: string;
  /** Fin vigencia oferta (ISO date). */
  activeUntil?: string;
};

/** Atributos libres que envía el front (varían por categoría). */
export type ProductAttributes = Record<string, unknown>;

/**
 * - `in_review`: recién creado, oculto a clientes; un admin lo pasa a `available` (DB).
 * - `available`: reservable, visible en la búsqueda de clientes.
 * - `rented`: alquilado (lo setea el flujo de órdenes).
 * - `inactive`: pausado por el provider, oculto a clientes.
 */
export type ProductStatus = 'available' | 'rented' | 'in_review' | 'inactive';

/** Únicos estados que el provider puede setear vía PATCH (y desde los que puede cambiar). */
export type ProviderSettableProductStatus = Extract<
  ProductStatus,
  'available' | 'inactive'
>;

export type ProductResponse = {
  id: string;
  storeId: string;
  userId: string;
  category: string;
  title: string;
  description: string;
  price: ProductPrice;
  attributes: ProductAttributes;
  medias: ProductMediaResponse[];
  status: ProductStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type ProductMediaUrls = {
  original: string;
  thumbnail: string;
  card: string;
  detail: string;
};

export type ProductMediaResponse = {
  id: string;
  /** Original (mismo que `urls.original`, para compat). */
  url: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
  urls: ProductMediaUrls;
};

export type ProductListResponse = {
  items: ProductResponse[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
