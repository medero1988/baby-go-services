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

export type ProductStatus = 'draft' | 'active' | 'inactive';

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
