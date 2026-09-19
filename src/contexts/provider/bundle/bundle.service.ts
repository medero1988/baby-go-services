import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ProductService } from '../product/product.service';
import { ProductDocument } from '../product/product.schema';
import {
  hasPricePatch,
  mergePrice,
  normalizePrice,
} from '../product/product-price';
import { StoreService } from '../store/store.service';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';
import { Bundle, BundleDocument } from './bundle.schema';
import {
  BundleListResponse,
  BundleResponse,
  BundleStatus,
} from './bundle.types';

const BUNDLE_CATEGORY = 'bundle';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;

@Injectable()
export class BundleService {
  constructor(
    @InjectModel(Bundle.name)
    private readonly bundleModel: Model<BundleDocument>,
    private readonly storeService: StoreService,
    private readonly productService: ProductService,
  ) {}

  async create(userId: string, dto: CreateBundleDto): Promise<BundleResponse> {
    const store = await this.storeService.requireStoreForProvider(userId);
    const title = dto.title.trim();
    await this.assertTitleAvailable(userId, title);

    const products = await this.productService.requireOwnedProducts(
      userId,
      dto.products,
    );

    const bundle = await this.bundleModel.create({
      userId,
      storeId: String(store._id),
      productIds: dto.products.map((id) => new Types.ObjectId(id)),
      title,
      description: dto.description.trim(),
      price: normalizePrice(dto.price),
      category: buildBundleCategories(products),
      status: 'draft',
    });

    return this.toResponse(bundle.toObject() as BundleDocument, products);
  }

  async findAllByOwner(
    userId: string,
    query: {
      status?: BundleStatus;
      category?: string;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<BundleListResponse> {
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

    const [bundles, total] = await Promise.all([
      this.bundleModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.bundleModel.countDocuments(filter).exec(),
    ]);

    const productIds = uniqueIds(
      bundles.flatMap((doc) => (doc.productIds ?? []).map((id) => String(id))),
    );
    const products = await this.productService.loadOwnedProducts(
      userId,
      productIds,
    );
    const productMap = new Map(
      products.map((doc) => [String(doc._id), doc] as const),
    );

    return {
      items: bundles.map((doc) =>
        this.toResponse(doc as BundleDocument, productMap),
      ),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async findOneByOwner(
    bundleId: string,
    userId: string,
  ): Promise<BundleResponse> {
    const bundle = await this.requireOwnedBundle(bundleId, userId);
    const products = await this.loadBundleProducts(userId, bundle);
    return this.toResponse(bundle.toObject() as BundleDocument, products);
  }

  async update(
    bundleId: string,
    userId: string,
    dto: UpdateBundleDto,
  ): Promise<BundleResponse> {
    const bundle = await this.requireOwnedBundle(bundleId, userId);

    if (!hasBundlePatchFields(dto)) {
      throw new BadRequestException({ error: 'no_fields_to_update' });
    }

    if (dto.title !== undefined) {
      const title = dto.title.trim();
      await this.assertTitleAvailable(userId, title, bundleId);
      bundle.title = title;
    }

    if (dto.description !== undefined) {
      bundle.description = dto.description.trim();
    }

    if (dto.price !== undefined && hasPricePatch(dto.price)) {
      bundle.price = mergePrice(bundle.price, dto.price);
      bundle.markModified('price');
    }

    if (dto.products !== undefined) {
      const products = await this.productService.requireOwnedProducts(
        userId,
        dto.products,
      );
      bundle.productIds = dto.products.map((id) => new Types.ObjectId(id));
      bundle.category = buildBundleCategories(products);
      bundle.markModified('productIds');
      bundle.markModified('category');
    }

    if (dto.status !== undefined) {
      bundle.status = dto.status;
    }

    if (bundle.status === 'active') {
      const products = await this.loadBundleProducts(userId, bundle);
      this.assertReadyToActivate(bundle, products);
    }

    await bundle.save();
    const products = await this.loadBundleProducts(userId, bundle);
    return this.toResponse(bundle.toObject() as BundleDocument, products);
  }

  async save(bundleId: string, userId: string): Promise<BundleResponse> {
    const bundle = await this.requireOwnedBundle(bundleId, userId);
    const products = await this.loadBundleProducts(userId, bundle);
    this.assertReadyToActivate(bundle, products);
    bundle.status = 'active';
    await bundle.save();
    return this.toResponse(bundle.toObject() as BundleDocument, products);
  }

  async remove(bundleId: string, userId: string): Promise<{ success: true }> {
    const bundle = await this.requireOwnedBundle(bundleId, userId);
    await this.bundleModel.deleteOne({ _id: bundle._id }).exec();
    return { success: true };
  }

  private assertReadyToActivate(
    bundle: BundleDocument,
    products: ProductDocument[],
  ): void {
    const missing: string[] = [];
    const productIds = (bundle.productIds ?? []).map((id) => String(id));

    if (!bundle.title?.trim()) missing.push('title');
    if (!bundle.description?.trim()) missing.push('description');

    const list = bundle.price?.list;
    if (typeof list !== 'number' || !Number.isFinite(list) || list <= 0) {
      missing.push('price');
    }

    if (productIds.length < 2) {
      missing.push('products');
    }

    if (missing.length) {
      throw new BadRequestException({
        error: 'bundle_incomplete',
        missing,
        message:
          'Complete title, description, price and at least two products before activating',
      });
    }

    if (products.length !== productIds.length) {
      const present = new Set(products.map((doc) => String(doc._id)));
      throw new BadRequestException({
        error: 'products_not_found',
        missing: productIds.filter((id) => !present.has(id)),
      });
    }

    const inactive = products.filter((doc) => doc.status !== 'active');
    if (inactive.length) {
      throw new BadRequestException({
        error: 'products_not_active',
        missing: inactive.map((doc) => String(doc._id)),
        message: 'All products in the bundle must be active',
      });
    }

    if (bundle.price?.offer !== undefined) {
      normalizePrice(bundle.price);
    }
  }

  private async requireOwnedBundle(
    bundleId: string,
    userId: string,
  ): Promise<BundleDocument> {
    const bundle = await this.bundleModel.findById(bundleId).exec();
    if (!bundle || String(bundle.userId) !== userId) {
      throw new NotFoundException({ error: 'bundle_not_found' });
    }
    return bundle;
  }

  private async loadBundleProducts(
    userId: string,
    bundle: BundleDocument,
  ): Promise<ProductDocument[]> {
    const ids = (bundle.productIds ?? []).map((id) => String(id));
    return this.productService.loadOwnedProducts(userId, ids);
  }

  private async assertTitleAvailable(
    userId: string,
    title: string,
    excludeBundleId?: string,
  ): Promise<void> {
    const query: Record<string, unknown> = {
      $expr: { $eq: [{ $toString: '$userId' }, userId] },
      title: new RegExp(`^${escapeRegex(title)}$`, 'i'),
    };
    if (excludeBundleId) {
      query._id = { $ne: excludeBundleId };
    }

    const existing = await this.bundleModel.findOne(query).lean().exec();
    if (existing) {
      throw new BadRequestException({
        error: 'title_not_available',
        message: 'This provider already has a bundle with that name',
      });
    }
  }

  private toResponse(
    doc: BundleDocument,
    productsOrMap: ProductDocument[] | Map<string, ProductDocument>,
  ): BundleResponse {
    const ids = (doc.productIds ?? []).map((id) => String(id));
    const productMap =
      productsOrMap instanceof Map
        ? productsOrMap
        : new Map(productsOrMap.map((p) => [String(p._id), p] as const));

    return {
      id: String(doc._id),
      storeId: String(doc.storeId),
      userId: String(doc.userId),
      products: ids
        .map((id) => productMap.get(id))
        .filter((p): p is ProductDocument => Boolean(p))
        .map((p) => this.productService.toResponse(p)),
      title: doc.title,
      description: doc.description,
      price: doc.price,
      category: doc.category ?? [BUNDLE_CATEGORY],
      status: doc.status,
      createdAt: (doc as { createdAt?: Date }).createdAt?.toISOString?.(),
      updatedAt: (doc as { updatedAt?: Date }).updatedAt?.toISOString?.(),
    };
  }
}

function buildBundleCategories(products: ProductDocument[]): string[] {
  const categories: string[] = [BUNDLE_CATEGORY];
  const seen = new Set(categories);
  for (const product of products) {
    const category = product.category?.trim().toLowerCase();
    if (!category || seen.has(category)) continue;
    seen.add(category);
    categories.push(category);
  }
  return categories;
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function hasBundlePatchFields(dto: UpdateBundleDto): boolean {
  return (
    dto.products !== undefined ||
    dto.title !== undefined ||
    dto.description !== undefined ||
    (dto.price !== undefined && hasPricePatch(dto.price)) ||
    dto.status !== undefined
  );
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
