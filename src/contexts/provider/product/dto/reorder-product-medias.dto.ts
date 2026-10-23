import { Allow } from 'class-validator';

/**
 * PUT /products/:id/medias/order
 * `mediaIds`: permutación exacta de los ids de las medias actuales del producto.
 * Índice 0 = foto principal (head); el orden del array = orden de la galería.
 * La forma se valida en el service para responder `invalid_media_order`
 * en vez del error genérico del ValidationPipe.
 */
export class ReorderProductMediasDto {
  @Allow()
  mediaIds: unknown;
}
