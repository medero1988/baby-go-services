import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StorageService } from '../../../shared/storage/storage.service';
import { StoreService } from '../store/store.service';
import { CreateProductDto } from './dto/create-product.dto';
import { Product, ProductDocument, ProductMedia } from './product.schema';
import {
  ProductMediaResponse,
  ProductPrice,
  ProductResponse,
} from './product.types';

const MAX_PRODUCT_MEDIAS = 8;

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly storeService: StoreService,
    private readonly storage: StorageService,
  ) {}

  /**
   * Crea un producto en la store del provider (estado `draft` hasta medias/save).
   * `attributes` se persiste tal cual lo envía el front.
   */
  async create(
    userId: string,
    dto: CreateProductDto,
  ): Promise<ProductResponse> {
    const store = await this.storeService.requireStoreForProvider(userId);
    const storeId = String(store._id);

    const product = await this.productModel.create({
      userId,
      storeId,
      category: dto.category.trim().toLowerCase(),
      title: dto.title.trim(),
      description: dto.description.trim(),
      price: normalizePrice(dto.price),
      attributes: dto.attributes ?? {},
      medias: [],
      status: 'draft',
    });

    return this.toResponse(product.toObject() as ProductDocument);
  }

  /** Productos de la store del provider autenticado. */
  async findAllByOwner(
    userId: string,
    query: { status?: ProductResponse['status']; category?: string } = {},
  ): Promise<ProductResponse[]> {
    await this.storeService.requireStoreForProvider(userId);

    const filter: Record<string, unknown> = {
      $expr: { $eq: [{ $toString: '$userId' }, userId] },
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.category?.trim()) {
      filter.category = query.category.trim().toLowerCase();
    }

    const products = await this.productModel
      .find(filter)
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return products.map((doc) => this.toResponse(doc as ProductDocument));
  }

  /** Detalle de un producto propio. */
  async findOneByOwner(
    productId: string,
    userId: string,
  ): Promise<ProductResponse> {
    const product = await this.requireOwnedProduct(productId, userId);
    return this.toResponse(product.toObject() as ProductDocument);
  }

  /** POST /products/:id/medias — responde `{ id, url }` (Miro). */
  async addMedia(
    productId: string,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<ProductMediaResponse> {
    if (!file) {
      throw new BadRequestException({
        error: 'media_missing',
        message:
          'Enviá una imagen en form-data (field `media`, tipo File). No pongas Content-Type a mano.',
      });
    }

    const product = await this.requireOwnedProduct(productId, userId);
    if ((product.medias?.length ?? 0) >= MAX_PRODUCT_MEDIAS) {
      throw new BadRequestException({
        error: 'medias_limit',
        message: `Maximum ${MAX_PRODUCT_MEDIAS} photos per product`,
      });
    }

    const ext = resolveImageExtension(file);
    if (!ext) {
      throw new BadRequestException({
        error: 'invalid_media_type',
        message:
          'Usá PNG, JPEG, WEBP o GIF. form-data field `media` (tipo File).',
      });
    }
    if (!file.buffer?.length) {
      throw new BadRequestException({ error: 'media_empty' });
    }

    const mediaId = new Types.ObjectId();
    const stored = await this.writeMediaFile(
      productId,
      String(mediaId),
      ext,
      file.buffer,
    );

    product.medias.push({
      _id: mediaId,
      url: stored.url,
      publicId: stored.publicId,
      width: stored.width,
      height: stored.height,
      format: stored.format,
      bytes: stored.bytes,
    } as ProductMedia & { _id: Types.ObjectId });
    await product.save();

    return this.toMediaResponse({
      _id: mediaId,
      url: stored.url,
      publicId: stored.publicId,
      width: stored.width,
      height: stored.height,
      format: stored.format,
      bytes: stored.bytes,
    });
  }

  /** PUT /products/:id/medias/:mediaId — responde nuevo `{ id, url }` (Miro). */
  async replaceMedia(
    productId: string,
    mediaId: string,
    userId: string,
    file?: Express.Multer.File,
  ): Promise<ProductMediaResponse> {
    if (!file) {
      throw new BadRequestException({
        error: 'media_missing',
        message:
          'Enviá una imagen en form-data (field `media`, tipo File). No pongas Content-Type a mano.',
      });
    }

    const product = await this.requireOwnedProduct(productId, userId);
    const idx = product.medias.findIndex((m) => String(m._id) === mediaId);
    if (idx < 0) {
      throw new NotFoundException({ error: 'media_not_found' });
    }

    const ext = resolveImageExtension(file);
    if (!ext) {
      throw new BadRequestException({
        error: 'invalid_media_type',
        message:
          'Usá PNG, JPEG, WEBP o GIF. form-data field `media` (tipo File).',
      });
    }
    if (!file.buffer?.length) {
      throw new BadRequestException({ error: 'media_empty' });
    }

    const previous = product.medias[idx];
    await this.storage.delete({
      url: previous.url,
      publicId: previous.publicId,
    });

    const newMediaId = new Types.ObjectId();
    const stored = await this.writeMediaFile(
      productId,
      String(newMediaId),
      ext,
      file.buffer,
    );

    product.medias[idx] = {
      _id: newMediaId,
      url: stored.url,
      publicId: stored.publicId,
      width: stored.width,
      height: stored.height,
      format: stored.format,
      bytes: stored.bytes,
    } as ProductMedia & { _id: Types.ObjectId };
    product.markModified('medias');
    await product.save();

    return this.toMediaResponse(product.medias[idx]);
  }

  /** DELETE /products/:id/medias/:mediaId */
  async deleteMedia(
    productId: string,
    mediaId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const product = await this.requireOwnedProduct(productId, userId);
    const media = product.medias.find((m) => String(m._id) === mediaId);
    if (!media) {
      throw new NotFoundException({ error: 'media_not_found' });
    }

    await this.storage.delete({ url: media.url, publicId: media.publicId });
    product.medias = product.medias.filter((m) => String(m._id) !== mediaId);
    product.markModified('medias');
    await product.save();
    return { success: true };
  }

  /** Save product: draft → active si hay al menos una foto. */
  async save(productId: string, userId: string): Promise<ProductResponse> {
    const product = await this.requireOwnedProduct(productId, userId);
    if (!product.medias?.length) {
      throw new BadRequestException({
        error: 'medias_required',
        message: 'Add at least one photo before saving',
      });
    }
    product.status = 'active';
    await product.save();
    return this.toResponse(product.toObject() as ProductDocument);
  }

  private async requireOwnedProduct(
    productId: string,
    userId: string,
  ): Promise<ProductDocument> {
    const product = await this.productModel.findById(productId).exec();
    if (!product || String(product.userId) !== userId) {
      throw new NotFoundException({ error: 'product_not_found' });
    }
    return product;
  }

  private async writeMediaFile(
    productId: string,
    mediaId: string,
    ext: string,
    buffer: Buffer,
  ) {
    return this.storage.uploadImage({
      buffer,
      folder: `products/${productId}`,
      filename: `${mediaId}.${ext}`,
    });
  }

  private toMediaResponse(m: ProductMedia): ProductMediaResponse {
    return {
      id: String((m as { _id?: Types.ObjectId })._id ?? ''),
      url: m.url,
      width: m.width,
      height: m.height,
      format: m.format,
      bytes: m.bytes,
      urls: this.storage.imageUrls(m.publicId, m.url),
    };
  }

  private toResponse(doc: ProductDocument): ProductResponse {
    return {
      id: String(doc._id),
      storeId: String(doc.storeId),
      userId: String(doc.userId),
      category: doc.category,
      title: doc.title,
      description: doc.description,
      price: doc.price,
      attributes: doc.attributes ?? {},
      medias: (doc.medias ?? []).map((m) => this.toMediaResponse(m)),
      status: doc.status,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString?.(),
      updatedAt: (doc as { updatedAt?: Date }).updatedAt?.toISOString?.(),
    };
  }
}

function normalizePrice(dto: CreateProductDto['price']): ProductPrice {
  if (dto.offer !== undefined && dto.offer > dto.list) {
    throw new BadRequestException({
      error: 'invalid_offer_price',
      message: 'offer must be less than or equal to list price',
    });
  }

  const price: ProductPrice = { list: dto.list };

  if (dto.offer !== undefined) {
    price.offer = dto.offer;
    price.activeFrom = normalizeDateInput(dto.activeFrom!, 'activeFrom');
    price.activeUntil = normalizeDateInput(dto.activeUntil!, 'activeUntil');
    if (price.activeUntil < price.activeFrom) {
      throw new BadRequestException({
        error: 'invalid_offer_dates',
        message: 'activeUntil must be on or after activeFrom',
      });
    }
  }

  return price;
}

/** Acepta YYYY-MM-DD o DD/MM/YYYY (Miro). Guarda ISO date YYYY-MM-DD. */
function normalizeDateInput(value: string, field: string): string {
  const raw = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

  let y: number;
  let m: number;
  let d: number;

  const isoMatch = raw.match(iso);
  const dmyMatch = raw.match(dmy);
  if (isoMatch) {
    y = Number(isoMatch[1]);
    m = Number(isoMatch[2]);
    d = Number(isoMatch[3]);
  } else if (dmyMatch) {
    d = Number(dmyMatch[1]);
    m = Number(dmyMatch[2]);
    y = Number(dmyMatch[3]);
  } else {
    throw new BadRequestException({
      error: 'invalid_date',
      field,
      message: 'Use YYYY-MM-DD or DD/MM/YYYY',
    });
  }

  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    throw new BadRequestException({ error: 'invalid_date', field });
  }

  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

function resolveImageExtension(file: Express.Multer.File): string | null {
  if (!file) return null;

  const mimeToExt: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  const mime = (file.mimetype ?? '').toLowerCase().trim();
  if (mimeToExt[mime]) return mimeToExt[mime];

  const name = (file.originalname ?? '').toLowerCase();
  const match = name.match(/\.(png|jpe?g|webp|gif)$/);
  if (match) return match[1] === 'jpeg' ? 'jpg' : match[1];

  return sniffImageExtension(file.buffer);
}

/** Fallback cuando Postman manda application/octet-stream sin extensión. */
function sniffImageExtension(buffer?: Buffer): string | null {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'png';
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
    return 'gif';
  }
  if (
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
