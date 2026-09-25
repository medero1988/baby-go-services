import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StorageService } from '../../../shared/storage/storage.service';
import { Bundle, BundleDocument } from '../../provider/bundle/bundle.schema';
import {
  Product,
  ProductDocument,
  ProductMedia,
} from '../../provider/product/product.schema';
import { ProductAttributes } from '../../provider/product/product.types';
import { Store, StoreDocument } from '../../provider/store/store.schema';
import {
  DeliveryDayKey,
  ServiceSchedule,
} from '../../provider/store/store.types';
import { SearchBodyDto } from './dto/search-body.dto';
import { SearchQueryDto } from './dto/search-query.dto';
import {
  SearchBundleProduct,
  SearchFulfillment,
  SearchItem,
  SearchMedia,
  SearchResponse,
  SearchStoreSummary,
} from './search.types';

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 20;

/** Atributos select que el filtro `types` puede matchear. */
const TYPE_ATTRIBUTE_KEYS = [
  'type',
  'style',
  'eceGroup',
  'frameType',
  'boxType',
  'size',
] as const;

const DAY_KEYS: DeliveryDayKey[] = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

type StoreLean = {
  _id: Types.ObjectId;
  name: string;
  country: string;
  address: SearchStoreSummary['address'];
  delivery?: ServiceSchedule;
  customerPickup?: ServiceSchedule;
};

type ProductLean = Product & {
  _id: Types.ObjectId;
  createdAt?: Date;
};

type BundleLean = Bundle & {
  _id: Types.ObjectId;
  createdAt?: Date;
};

type CategoryFilter = {
  name: string;
  types: string[];
  accessories: string[];
};

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Bundle.name)
    private readonly bundleModel: Model<BundleDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    private readonly storage: StorageService,
  ) {}

  async search(
    query: SearchQueryDto,
    body: SearchBodyDto,
  ): Promise<SearchResponse> {
    const offset = query.offset ?? DEFAULT_OFFSET;
    const limit = query.limit ?? DEFAULT_LIMIT;
    this.assertRentalPeriod(body);

    const categories = normalizeCategories(body.categories);
    const storeIds = await this.resolveStoreIds(body);
    if (storeIds && storeIds.length === 0) {
      return { data: [], total: 0, nextPage: null };
    }

    const [products, bundles] = await Promise.all([
      this.productModel
        .find(this.productFilter(storeIds, categories))
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
      this.bundleModel
        .find(this.bundleFilter(storeIds, categories))
        .sort({ createdAt: -1 })
        .lean()
        .exec(),
    ]);

    const memberProducts = await this.loadBundleMembers(
      bundles as BundleLean[],
    );
    const matchedBundles = (bundles as BundleLean[]).filter((bundle) =>
      bundleMatches(bundle, memberProducts, categories),
    );

    const stores = await this.loadStoresFor([
      ...(products as ProductLean[]).map((product) => String(product.storeId)),
      ...matchedBundles.map((bundle) => String(bundle.storeId)),
    ]);

    const items = [
      ...(products as ProductLean[]).flatMap((product) => {
        const item = this.toProductItem(product, stores);
        return item ? [{ at: product.createdAt?.getTime() ?? 0, item }] : [];
      }),
      ...matchedBundles.flatMap((bundle) => {
        const item = this.toBundleItem(bundle, memberProducts, stores);
        return item ? [{ at: bundle.createdAt?.getTime() ?? 0, item }] : [];
      }),
    ]
      .sort((a, b) => b.at - a.at)
      .map((entry) => entry.item);

    const page = items.slice(offset, offset + limit);
    const nextOffset = offset + limit;
    return {
      data: page,
      total: items.length,
      nextPage:
        nextOffset < items.length ? { offset: nextOffset, limit } : null,
    };
  }

  private assertRentalPeriod(body: SearchBodyDto): void {
    const period = body.rentalPeriod;
    if (!period) return;
    if (new Date(period.start).getTime() > new Date(period.end).getTime()) {
      throw new BadRequestException({
        error: 'invalid_rental_period',
        message: 'rentalPeriod.start must be before or equal to end',
      });
    }
  }

  /**
   * null = no restringir por store.
   * [] = el filtro de destino/entrega no matchea ninguna store.
   */
  private async resolveStoreIds(
    body: SearchBodyDto,
  ): Promise<Types.ObjectId[] | null> {
    const needsDelivery = handoffNeeds(body, 'delivery');
    const needsPickup = handoffNeeds(body, 'customer_pickup');
    const country = body.destination?.country?.trim();
    const city = body.destination?.city?.trim();
    const hasStoreFilter = Boolean(
      country || city || needsDelivery || needsPickup,
    );
    if (!hasStoreFilter) return null;

    const filter: Record<string, unknown> = {};
    if (country) {
      filter.country = new RegExp(`^${escapeRegex(country)}$`, 'i');
    }
    if (city) {
      const cityRe = new RegExp(escapeRegex(city), 'i');
      filter.$or = [
        { 'address.addressLine1': cityRe },
        { 'address.addressLine2': cityRe },
      ];
    }
    if (needsDelivery) filter['delivery.available'] = true;
    if (needsPickup) filter['customerPickup.available'] = true;

    const stores = await this.storeModel
      .find(filter)
      .select({ delivery: 1, customerPickup: 1 })
      .lean()
      .exec();

    const acquisitionDay = body.rentalPeriod
      ? dayKey(body.rentalPeriod.start)
      : undefined;
    const devolutionDay = body.rentalPeriod
      ? dayKey(body.rentalPeriod.end)
      : undefined;

    return stores
      .filter((store) =>
        storeCoversHandoff(
          store.delivery,
          body.acquisition,
          'delivery',
          acquisitionDay,
        ),
      )
      .filter((store) =>
        storeCoversHandoff(
          store.customerPickup,
          body.acquisition,
          'customer_pickup',
          acquisitionDay,
        ),
      )
      .filter((store) =>
        storeCoversHandoff(
          store.delivery,
          body.devolution,
          'delivery',
          devolutionDay,
        ),
      )
      .filter((store) =>
        storeCoversHandoff(
          store.customerPickup,
          body.devolution,
          'customer_pickup',
          devolutionDay,
        ),
      )
      .map((store) => store._id);
  }

  private productFilter(
    storeIds: Types.ObjectId[] | null,
    categories: CategoryFilter[],
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = { status: 'active' };
    if (storeIds) filter.storeId = { $in: idVariants(storeIds) };
    if (categories.length) {
      filter.$or = categories.map((category) =>
        productCategoryClause(category),
      );
    }
    return filter;
  }

  private bundleFilter(
    storeIds: Types.ObjectId[] | null,
    categories: CategoryFilter[],
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = { status: 'active' };
    if (storeIds) filter.storeId = { $in: idVariants(storeIds) };
    if (categories.length) {
      filter.$or = categories.map((category) => ({ category: category.name }));
    }
    return filter;
  }

  private async loadBundleMembers(
    bundles: BundleLean[],
  ): Promise<Map<string, ProductLean>> {
    const ids = [
      ...new Set(
        bundles.flatMap((bundle) =>
          (bundle.productIds ?? []).map((id) => String(id)),
        ),
      ),
    ].filter((id) => Types.ObjectId.isValid(id));
    if (!ids.length) return new Map();

    const docs = await this.productModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .lean()
      .exec();
    return new Map(
      (docs as ProductLean[]).map((doc) => [String(doc._id), doc] as const),
    );
  }

  private async loadStoresFor(
    rawIds: string[],
  ): Promise<Map<string, StoreLean>> {
    const ids = [...new Set(rawIds)].filter((id) => Types.ObjectId.isValid(id));
    if (!ids.length) return new Map();

    const docs = await this.storeModel
      .find({ _id: { $in: ids } })
      .select({
        name: 1,
        country: 1,
        address: 1,
        delivery: 1,
        customerPickup: 1,
      })
      .lean()
      .exec();

    return new Map(
      (docs as StoreLean[]).map((doc) => [String(doc._id), doc] as const),
    );
  }

  private toProductItem(
    product: ProductLean,
    stores: Map<string, StoreLean>,
  ): SearchItem | null {
    const store = stores.get(String(product.storeId));
    if (!store) return null;
    return {
      kind: 'product',
      id: String(product._id),
      title: product.title,
      description: product.description,
      category: product.category,
      price: product.price,
      attributes: product.attributes ?? {},
      medias: (product.medias ?? []).map((media) => this.toMedia(media)),
      store: toStoreSummary(store),
    };
  }

  private toBundleItem(
    bundle: BundleLean,
    members: Map<string, ProductLean>,
    stores: Map<string, StoreLean>,
  ): SearchItem | null {
    const store = stores.get(String(bundle.storeId));
    if (!store) return null;
    const products = (bundle.productIds ?? [])
      .map((id) => members.get(String(id)))
      .filter((product): product is ProductLean => Boolean(product));
    return {
      kind: 'bundle',
      id: String(bundle._id),
      title: bundle.title,
      description: bundle.description,
      category: bundle.category ?? ['bundle'],
      price: bundle.price,
      products: products.map(toBundleProduct),
      medias: products.flatMap((product) =>
        (product.medias ?? []).slice(0, 1).map((media) => this.toMedia(media)),
      ),
      store: toStoreSummary(store),
    };
  }

  private toMedia(media: ProductMedia): SearchMedia {
    return {
      id: String(media._id ?? ''),
      url: media.url,
      urls: this.storage.imageUrls(media.publicId, media.url),
    };
  }
}

function normalizeCategories(
  categories: SearchBodyDto['categories'],
): CategoryFilter[] {
  return (categories ?? [])
    .map((category) => ({
      name: category.name.trim().toLowerCase(),
      types: (category.types ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
      accessories: (category.accessories ?? [])
        .map((value) => value.trim())
        .filter(Boolean),
    }))
    .filter((category) => category.name.length > 0);
}

function productCategoryClause(
  category: CategoryFilter,
): Record<string, unknown> {
  const base: Record<string, unknown> = { category: category.name };
  const and: Record<string, unknown>[] = [base];
  if (category.types.length) {
    and.push({
      $or: TYPE_ATTRIBUTE_KEYS.map((key) => ({
        [`attributes.${key}`]: { $in: category.types },
      })),
    });
  }
  if (category.accessories.length) {
    and.push({ 'attributes.accessories': { $in: category.accessories } });
  }
  return and.length === 1 ? base : { $and: and };
}

function bundleMatches(
  bundle: BundleLean,
  members: Map<string, ProductLean>,
  categories: CategoryFilter[],
): boolean {
  if (!categories.length) return true;
  const names = new Set(
    (bundle.category ?? []).map((value) => value.toLowerCase()),
  );
  return categories.some((category) => {
    if (!names.has(category.name)) return false;
    if (!category.types.length && !category.accessories.length) return true;
    return (bundle.productIds ?? []).some((id) => {
      const product = members.get(String(id));
      if (!product || product.category !== category.name) return false;
      return (
        matchesTypes(product.attributes, category.types) &&
        matchesAccessories(product.attributes, category.accessories)
      );
    });
  });
}

function matchesTypes(
  attributes: ProductAttributes | undefined,
  types: string[],
): boolean {
  if (!types.length) return true;
  const attrs = attributes ?? {};
  return TYPE_ATTRIBUTE_KEYS.some((key) => {
    const value = attrs[key];
    return typeof value === 'string' && types.includes(value);
  });
}

function matchesAccessories(
  attributes: ProductAttributes | undefined,
  accessories: string[],
): boolean {
  if (!accessories.length) return true;
  const value = (attributes ?? {}).accessories;
  if (!Array.isArray(value)) return false;
  const present = new Set(value.map((item) => String(item)));
  return accessories.some((item) => present.has(item));
}

function handoffNeeds(
  body: SearchBodyDto,
  type: 'delivery' | 'customer_pickup',
): boolean {
  return body.acquisition?.type === type || body.devolution?.type === type;
}

function storeCoversHandoff(
  schedule: ServiceSchedule | undefined,
  handoff: SearchBodyDto['acquisition'],
  type: 'delivery' | 'customer_pickup',
  day: DeliveryDayKey | undefined,
): boolean {
  if (!handoff || handoff.type !== type) return true;
  if (!schedule?.available) return false;
  if (handoff.time === undefined) return true;
  if (schedule.available24h) return true;
  return rangesForDay(schedule, day).some((range) =>
    rangeContains(range, handoff.time as number),
  );
}

function rangesForDay(
  schedule: ServiceSchedule,
  day: DeliveryDayKey | undefined,
): string[] {
  const all = schedule.timeRanges ?? [];
  if (!day || !schedule.days) return all;
  const indexes = schedule.days[day];
  if (!indexes?.length) return [];
  return indexes
    .map((index) => all[index])
    .filter((range): range is string => Boolean(range));
}

function rangeContains(range: string, minutes: number): boolean {
  const match = range
    .trim()
    .match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const start = Number(match[1]) * 60 + Number(match[2]);
  const end = Number(match[3]) * 60 + Number(match[4]);
  return minutes >= start && minutes <= end;
}

function dayKey(iso: string): DeliveryDayKey {
  return DAY_KEYS[new Date(iso).getUTCDay()];
}

function idVariants(ids: Types.ObjectId[]): Array<string | Types.ObjectId> {
  return ids.flatMap((id) => [id, String(id)]);
}

function toStoreSummary(store: StoreLean): SearchStoreSummary {
  return {
    id: String(store._id),
    name: store.name,
    country: store.country,
    address: store.address,
    delivery: toFulfillment(store.delivery),
    customerPickup: toFulfillment(store.customerPickup),
  };
}

function toFulfillment(
  schedule: ServiceSchedule | undefined,
): SearchFulfillment | undefined {
  if (!schedule) return undefined;
  return {
    available: schedule.available,
    available24h: schedule.available24h,
    timeRanges: schedule.timeRanges ?? [],
    days: schedule.days,
  };
}

function toBundleProduct(product: ProductLean): SearchBundleProduct {
  return {
    id: String(product._id),
    title: product.title,
    category: product.category,
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
