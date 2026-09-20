import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StorageService } from '../../../shared/storage/storage.service';
import { Bundle, BundleDocument } from '../bundle/bundle.schema';
import { StoreService } from '../store/store.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument, ProductMedia } from './product.schema';
import { hasPricePatch, mergePrice, normalizePrice } from './product-price';
import {
  ProductAttributes,
  ProductListResponse,
  ProductMediaResponse,
  ProductResponse,
} from './product.types';

const MAX_PRODUCT_MEDIAS = 8;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class ProductService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Bundle.name)
    private readonly bundleModel: Model<BundleDocument>,
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
    const title = dto.title.trim();

    await this.assertTitleAvailable(userId, title);

    const product = await this.productModel.create({
      userId,
      storeId,
      category: dto.category.trim().toLowerCase(),
      title,
      description: dto.description.trim(),
      price: normalizePrice(dto.price),
      attributes: dto.attributes ?? {},
      medias: [],
      status: 'draft',
    });

    return this.toResponse(product.toObject() as ProductDocument);
  }

  /**
   * PATCH parcial de un producto propio.
   * Si el resultado queda `active`, se revalida completitud.
   */
  async update(
    productId: string,
    userId: string,
    dto: UpdateProductDto,
  ): Promise<ProductResponse> {
    const product = await this.requireOwnedProduct(productId, userId);

    if (!hasPatchFields(dto)) {
      throw new BadRequestException({ error: 'no_fields_to_update' });
    }

    if (dto.category !== undefined) {
      product.category = dto.category.trim().toLowerCase();
    }

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      await this.assertTitleAvailable(userId, title, productId);
      product.title = title;
    }

    if (dto.description !== undefined) {
      product.description = dto.description.trim();
    }

    if (dto.price !== undefined && hasPricePatch(dto.price)) {
      product.price = mergePrice(product.price, dto.price);
      product.markModified('price');
    }

    if (dto.attributes !== undefined) {
      product.attributes = mergeAttributes(product.attributes, dto.attributes);
      product.markModified('attributes');
    }

    if (dto.status !== undefined) {
      product.status = dto.status;
    }

    if (product.status === 'active') {
      this.assertReadyToActivate(product);
    }

    await product.save();
    return this.toResponse(product.toObject() as ProductDocument);
  }

  /** Productos propios por id, en el orden pedido. Falla si falta alguno. */
  async requireOwnedProducts(
    userId: string,
    ids: string[],
  ): Promise<ProductDocument[]> {
    const found = await this.loadOwnedProducts(userId, ids);
    if (found.length !== ids.length) {
      const present = new Set(found.map((doc) => String(doc._id)));
      throw new BadRequestException({
        error: 'products_not_found',
        missing: ids.filter((id) => !present.has(id)),
      });
    }
    return found;
  }

  /** Productos propios encontrados (omite ids ajenos o inexistentes). */
  async loadOwnedProducts(
    userId: string,
    ids: string[],
  ): Promise<ProductDocument[]> {
    if (!ids.length) return [];
    const docs = await this.productModel.find({ _id: { $in: ids } }).exec();
    const byId = new Map<string, ProductDocument>();
    for (const doc of docs) {
      if (String(doc.userId) === userId) {
        byId.set(String(doc._id), doc);
      }
    }
    return ids
      .map((id) => byId.get(id))
      .filter((doc): doc is ProductDocument => Boolean(doc));
  }

  /** Productos de la store del provider autenticado. */
  async findAllByOwner(
    userId: string,
    query: {
      status?: ProductResponse['status'];
      category?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<ProductListResponse> {
    await this.storeService.requireStoreForProvider(userId);

    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      $expr: { $eq: [{ $toString: '$userId' }, userId] },
    };
    if (query.status) {
      filter.status = query.status;
    }
    if (query.category?.trim()) {
      filter.category = query.category.trim().toLowerCase();
    }

    const [products, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      items: products.map((doc) => this.toResponse(doc as ProductDocument)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
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
          'Enviá form-data field `media` tipo File. En Postman: Headers → desactivá Content-Type (Postman arma el boundary). Si hay triángulo amarillo, volvé a elegir el archivo.',
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
          'Enviá form-data field `media` tipo File. En Postman: Headers → desactivá Content-Type (Postman arma el boundary). Si hay triángulo amarillo, volvé a elegir el archivo.',
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
    await this.deleteMediaFromBucket(previous);

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

  /** DELETE /products/:id/medias/:mediaId — borra DB + bucket. */
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

    await this.deleteMediaFromBucket(media);
    product.medias = product.medias.filter((m) => String(m._id) !== mediaId);
    product.markModified('medias');
    await product.save();
    return { success: true };
  }

  /**
   * DELETE /products/:id — borra producto, todas sus medias del bucket
   * y lo saca de bundles del provider (borra bundles que queden con <2 productos).
   */
  async remove(
    productId: string,
    userId: string,
  ): Promise<{ success: true }> {
    const product = await this.requireOwnedProduct(productId, userId);

    await this.deleteAllMediasFromBucket(product.medias ?? []);

    await this.detachProductFromBundles(userId, productId);
    await this.productModel.deleteOne({ _id: product._id }).exec();

    return { success: true };
  }

  /**
   * Save product: draft → active.
   * Requiere título, descripción, categoría, precio, attributes y ≥1 media.
   */
  async save(productId: string, userId: string): Promise<ProductResponse> {
    const product = await this.requireOwnedProduct(productId, userId);
    this.assertReadyToActivate(product);
    product.status = 'active';
    await product.save();
    return this.toResponse(product.toObject() as ProductDocument);
  }

  private assertReadyToActivate(product: ProductDocument): void {
    const missing: string[] = [];

    if (!product.title?.trim()) missing.push('title');
    if (!product.description?.trim()) missing.push('description');
    if (!product.category?.trim()) missing.push('category');

    const list = product.price?.list;
    if (typeof list !== 'number' || !Number.isFinite(list) || list <= 0) {
      missing.push('price');
    }

    if (!hasMeaningfulAttributes(product.attributes)) {
      missing.push('attributes');
    }

    const medias = (product.medias ?? []).filter((m) => m.url?.trim());
    if (!medias.length) {
      missing.push('medias');
    }

    if (missing.length) {
      throw new BadRequestException({
        error: 'product_incomplete',
        missing,
        message:
          'Complete title, description, category, price, attributes and at least one photo before activating',
      });
    }

    if (product.price?.offer !== undefined) {
      normalizePrice(product.price);
    }
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

  private async deleteMediaFromBucket(media: ProductMedia): Promise<void> {
    await this.storage.delete({
      url: media.url,
      publicId: media.publicId,
    });
  }

  private async deleteAllMediasFromBucket(
    medias: ProductMedia[],
  ): Promise<void> {
    await Promise.all(medias.map((m) => this.deleteMediaFromBucket(m)));
  }

  /** Saca el producto de bundles; elimina bundles que queden inválidos (<2 items). */
  private async detachProductFromBundles(
    userId: string,
    productId: string,
  ): Promise<void> {
    const oid = new Types.ObjectId(productId);
    await this.bundleModel
      .updateMany(
        {
          $expr: { $eq: [{ $toString: '$userId' }, userId] },
          productIds: oid,
        },
        { $pull: { productIds: oid } },
      )
      .exec();

    await this.bundleModel
      .deleteMany({
        $expr: { $eq: [{ $toString: '$userId' }, userId] },
        $or: [
          { productIds: { $exists: false } },
          { productIds: { $size: 0 } },
          { productIds: { $size: 1 } },
        ],
      })
      .exec();
  }

  private async assertTitleAvailable(
    userId: string,
    title: string,
    excludeProductId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = {
      $expr: { $eq: [{ $toString: '$userId' }, userId] },
      title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
    };
    if (excludeProductId) {
      query._id = { $ne: excludeProductId };
    }

    const existing = await this.productModel.findOne(query).lean().exec();
    if (existing) {
      throw new BadRequestException({
        error: 'title_not_available',
        message: 'This provider already has a product with that name',
      });
    }
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

  toResponse(doc: ProductDocument): ProductResponse {
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

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasPatchFields(dto: UpdateProductDto): boolean {
  return (
    dto.category !== undefined ||
    dto.title !== undefined ||
    dto.description !== undefined ||
    (dto.price !== undefined && hasPricePatch(dto.price)) ||
    dto.attributes !== undefined ||
    dto.status !== undefined
  );
}

function mergeAttributes(
  current: ProductAttributes | undefined,
  patch: ProductAttributes,
): ProductAttributes {
  const next: ProductAttributes = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else {
      next[key] = value;
    }
  }
  return next;
}

function hasMeaningfulAttributes(
  attributes: Record<string, unknown> | undefined,
): boolean {
  if (
    !attributes ||
    typeof attributes !== 'object' ||
    Array.isArray(attributes)
  ) {
    return false;
  }

  return Object.values(attributes).some((value) =>
    isMeaningfulAttribute(value),
  );
}

function isMeaningfulAttribute(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) {
    return value.some((item) => isMeaningfulAttribute(item));
  }
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) =>
      isMeaningfulAttribute(item),
    );
  }
  return false;
}
