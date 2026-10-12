import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StorageService } from '../../../shared/storage/storage.service';
import { Bundle, BundleDocument } from '../../provider/bundle/bundle.schema';
import {
  Product,
  ProductDocument,
  ProductMedia,
} from '../../provider/product/product.schema';
import { ProductPrice } from '../../provider/product/product.types';
import { Store, StoreDocument } from '../../provider/store/store.schema';
import { AttentionSchedule } from '../../provider/store/store.types';
import {
  Cart,
  CartDocument,
  CartHandoff,
  CartHandoffType,
  CartItem,
  CartStoreGroup,
} from './cart.schema';
import {
  AddCartItemDto,
  CartHandoffDto,
  CartProductInputDto,
  RemoveCartItemsDto,
  UpdateCartAccessoriesDto,
  UpdateCartDto,
} from './dto/cart.dto';
import {
  CartCountResponse,
  CartHandoffResponse,
  CartLineResponse,
  CartMoney,
  CartResponse,
  CartStoreResponse,
  CartTotals,
} from './cart.types';

const CURRENCY = 'EUR' as const;

type ProductLean = Product & { _id: Types.ObjectId };
type StoreLean = {
  _id: Types.ObjectId;
  name: string;
  delivery?: AttentionSchedule;
};

type BundleLean = Bundle & { _id: Types.ObjectId };

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name)
    private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Bundle.name)
    private readonly bundleModel: Model<BundleDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
    private readonly storage: StorageService,
  ) {}

  async count(userId: string): Promise<CartCountResponse> {
    const cart = await this.findCart(userId);
    return { count: itemCount(cart) };
  }

  async get(userId: string): Promise<CartResponse> {
    const cart = await this.findCart(userId);
    return this.toResponse(cart);
  }

  async add(userId: string, dto: AddCartItemDto): Promise<CartResponse> {
    const inputs = resolveCartInputs(dto);
    const period = parsePeriod(dto.rentalPeriod.start, dto.rentalPeriod.end);
    const acquisition = normalizeHandoff(dto.acquisition);
    const devolution = normalizeHandoff(dto.devolution);
    const lines: { storeId: string; item: CartItem }[] = [];
    for (const input of inputs) {
      lines.push(await this.buildLine(input));
    }

    const cart = await this.findCart(userId);
    const doc =
      cart ??
      new this.cartModel({
        userId: new Types.ObjectId(userId),
        stores: [],
      });

    doc.city = dto.city.trim();
    doc.country = dto.country.trim();
    doc.rentalPeriod = period;

    for (const line of lines) {
      this.upsertLine(doc, line, acquisition, devolution);
    }

    doc.markModified('stores');
    await doc.save();
    return this.toResponse(doc);
  }

  async update(userId: string, dto: UpdateCartDto): Promise<CartResponse> {
    const updatesPeriod = dto.start !== undefined || dto.end !== undefined;
    const updatesHandoff =
      dto.storeId !== undefined ||
      dto.acquisition !== undefined ||
      dto.devolution !== undefined;
    if (!updatesPeriod && !updatesHandoff) {
      throw new BadRequestException({ error: 'no_fields_to_update' });
    }

    const cart = await this.requireCart(userId);

    if (updatesPeriod) {
      if (!dto.start || !dto.end) {
        throw new BadRequestException({
          error: 'invalid_rental_period',
          message: 'start and end are required together',
        });
      }
      cart.rentalPeriod = parsePeriod(dto.start, dto.end);
    }

    if (updatesHandoff) {
      if (!dto.storeId || !dto.acquisition || !dto.devolution) {
        throw new BadRequestException({
          error: 'invalid_handoff',
          message: 'storeId, acquisition and devolution are required together',
        });
      }
      const storeId = parseObjectId(dto.storeId, 'invalid_store_id');
      const group = cart.stores.find(
        (entry) => String(entry.storeId) === storeId,
      );
      if (!group) {
        throw new NotFoundException({ error: 'store_not_in_cart' });
      }
      group.acquisition = normalizeHandoff(dto.acquisition);
      group.devolution = normalizeHandoff(dto.devolution);
      cart.markModified('stores');
    }

    await cart.save();
    return this.toResponse(cart);
  }

  async updateAccessories(
    userId: string,
    productIdRaw: string,
    dto: UpdateCartAccessoriesDto,
  ): Promise<{ ok: true }> {
    const productId = parseObjectId(productIdRaw, 'invalid_product_id');
    const cart = await this.requireCart(userId);
    if (findBundleItem(cart, productId)) {
      throw new BadRequestException({ error: 'bundle_has_no_accessories' });
    }
    const item = findProductItem(cart, productId);
    if (!item) {
      throw new NotFoundException({ error: 'product_not_in_cart' });
    }

    const product = await this.productModel.findById(productId).lean().exec();
    if (!product) {
      throw new NotFoundException({ error: 'product_not_found' });
    }
    item.accessories = this.assertAccessories(
      product as ProductLean,
      dto.accessories,
    );
    cart.markModified('stores');
    await cart.save();
    return { ok: true };
  }

  async remove(userId: string, dto: RemoveCartItemsDto): Promise<{ ok: true }> {
    const drop = lineIdSet([
      ...(dto.productIds ?? []),
      ...(dto.bundleIds ?? []),
    ]);
    if (!drop.size) {
      throw new BadRequestException({ error: 'item_ids_required' });
    }
    const cart = await this.findCart(userId);
    if (!cart) {
      throw new NotFoundException({ error: 'cart_not_found' });
    }

    let removed = 0;
    const stores = cart.stores
      .map((group) => ({
        storeId: group.storeId,
        acquisition: group.acquisition,
        devolution: group.devolution,
        items: group.items
          .filter((item) => {
            const lineId = itemLineId(item);
            if (!lineId || !drop.has(lineId)) return true;
            removed += 1;
            return false;
          })
          .map((item) => ({
            kind: item.kind,
            ...(item.productId ? { productId: item.productId } : {}),
            ...(item.bundleId ? { bundleId: item.bundleId } : {}),
            accessories: item.accessories ?? [],
          })),
      }))
      .filter((group) => group.items.length > 0);

    if (!removed) {
      throw new NotFoundException({ error: 'item_not_in_cart' });
    }

    await this.cartModel.updateOne({ _id: cart._id }, { $set: { stores } });
    return { ok: true };
  }

  private async findCart(userId: string): Promise<CartDocument | null> {
    const id = String(userId ?? '').trim();
    if (!Types.ObjectId.isValid(id)) return null;
    return this.cartModel.findOne({ userId: new Types.ObjectId(id) }).exec();
  }

  private async requireCart(userId: string): Promise<CartDocument> {
    const cart = await this.findCart(userId);
    if (!cart) {
      throw new NotFoundException({ error: 'cart_not_found' });
    }
    return cart;
  }

  private async buildLine(
    input: CartLineInput,
  ): Promise<{ storeId: string; item: CartItem }> {
    const hasProduct = Boolean(input.productId?.trim());
    const hasBundle = Boolean(input.bundleId?.trim());
    if (hasProduct === hasBundle) {
      throw new BadRequestException({
        error: 'invalid_cart_item',
        message: 'Each item needs productId or bundleId, not both',
      });
    }
    return hasProduct
      ? this.buildProductLine(input.productId as string, input.accessories)
      : this.buildBundleLine(input.bundleId as string, input.accessories);
  }

  private upsertLine(
    doc: CartDocument,
    line: { storeId: string; item: CartItem },
    acquisition: CartHandoff,
    devolution: CartHandoff,
  ): void {
    const group = doc.stores.find(
      (entry) => String(entry.storeId) === line.storeId,
    );
    if (!group) {
      doc.stores.push({
        storeId: new Types.ObjectId(line.storeId),
        acquisition,
        devolution,
        items: [line.item],
      });
      return;
    }
    group.acquisition = acquisition;
    group.devolution = devolution;
    const existing = group.items.find((entry) => sameLine(entry, line.item));
    if (existing) {
      existing.kind = line.item.kind;
      existing.accessories = line.item.accessories;
      return;
    }
    group.items.push(line.item);
  }

  private async buildProductLine(
    productIdRaw: string,
    accessories: string[] | undefined,
  ): Promise<{ storeId: string; item: CartItem }> {
    const productId = parseObjectId(productIdRaw, 'invalid_product_id');
    const product = await this.requireActiveProduct(productId);
    return {
      storeId: String(product.storeId),
      item: {
        kind: 'product',
        productId: new Types.ObjectId(productId),
        accessories: this.assertAccessories(product, accessories ?? []),
      },
    };
  }

  private async buildBundleLine(
    bundleIdRaw: string,
    accessories: string[] | undefined,
  ): Promise<{ storeId: string; item: CartItem }> {
    if (accessories?.length) {
      throw new BadRequestException({ error: 'bundle_has_no_accessories' });
    }
    const bundleId = parseObjectId(bundleIdRaw, 'invalid_bundle_id');
    const bundle = await this.bundleModel.findById(bundleId).lean().exec();
    if (!bundle) {
      throw new NotFoundException({ error: 'bundle_not_found' });
    }
    if (bundle.status !== 'available') {
      throw new BadRequestException({ error: 'bundle_not_available' });
    }
    const memberIds = (bundle.productIds ?? []).map((id) => String(id));
    const members = memberIds.length
      ? await this.productModel
          .find({ _id: { $in: memberIds } })
          .select({ status: 1 })
          .lean()
          .exec()
      : [];
    const membersAvailable =
      members.length === memberIds.length &&
      members.every((product) => product.status === 'available');
    if (!membersAvailable) {
      throw new BadRequestException({
        error: 'bundle_not_available',
        message: 'Bundle products must be available',
      });
    }
    return {
      storeId: String(bundle.storeId),
      item: {
        kind: 'bundle',
        bundleId: new Types.ObjectId(bundleId),
        accessories: [],
      },
    };
  }

  private async requireActiveProduct(productId: string): Promise<ProductLean> {
    const product = await this.productModel.findById(productId).lean().exec();
    if (!product) {
      throw new NotFoundException({ error: 'product_not_found' });
    }
    if (product.status !== 'available') {
      throw new BadRequestException({ error: 'product_not_available' });
    }
    return product as ProductLean;
  }

  private assertAccessories(
    product: ProductLean,
    selected: string[],
  ): string[] {
    const allowed = accessoryOptions(product);
    const unique = [
      ...new Set(selected.map((value) => value.trim()).filter(Boolean)),
    ];
    const unknown = unique.filter((value) => !allowed.includes(value));
    if (unknown.length) {
      throw new BadRequestException({
        error: 'invalid_accessories',
        accessories: unknown,
      });
    }
    return unique;
  }

  private async toResponse(cart: CartDocument | null): Promise<CartResponse> {
    if (!cart) {
      return emptyCart();
    }

    const lines = cart.stores.flatMap((group) => group.items);
    const bundleIds = lines
      .filter((item) => isBundleItem(item) && item.bundleId)
      .map((item) => String(item.bundleId));
    const bundles = bundleIds.length
      ? ((await this.bundleModel
          .find({ _id: { $in: bundleIds } })
          .lean()
          .exec()) as BundleLean[])
      : [];
    const bundleMap = new Map(
      bundles.map((doc) => [String(doc._id), doc] as const),
    );

    const productIds = [
      ...lines
        .filter((item) => !isBundleItem(item) && item.productId)
        .map((item) => String(item.productId)),
      ...bundles.flatMap((bundle) =>
        (bundle.productIds ?? []).map((id) => String(id)),
      ),
    ];
    const storeIds = cart.stores.map((group) => String(group.storeId));

    const [products, stores] = await Promise.all([
      productIds.length
        ? this.productModel
            .find({ _id: { $in: [...new Set(productIds)] } })
            .lean()
            .exec()
        : [],
      storeIds.length
        ? this.storeModel
            .find({ _id: { $in: storeIds } })
            .select({ name: 1, delivery: 1 })
            .lean()
            .exec()
        : [],
    ]);

    const productMap = new Map(
      (products as ProductLean[]).map((doc) => [String(doc._id), doc] as const),
    );
    const storeMap = new Map(
      (stores as StoreLean[]).map((doc) => [String(doc._id), doc] as const),
    );
    const days = rentalDays(cart.rentalPeriod);
    const rentalStart = cart.rentalPeriod?.start;

    const productsByStore = cart.stores.map((group) =>
      this.toStoreGroup(
        group,
        productMap,
        bundleMap,
        storeMap,
        days,
        rentalStart,
      ),
    );
    const taxAmount = 0;

    return {
      city: cart.city ?? null,
      country: cart.country ?? null,
      tax: money(taxAmount),
      days,
      rentalPeriod: cart.rentalPeriod
        ? {
            start: toDmy(cart.rentalPeriod.start),
            end: toDmy(cart.rentalPeriod.end),
          }
        : null,
      productsByStore,
      totals: cartTotals(productsByStore, days, taxAmount),
    };
  }

  private toStoreGroup(
    group: CartStoreGroup,
    products: Map<string, ProductLean>,
    bundles: Map<string, BundleLean>,
    stores: Map<string, StoreLean>,
    days: number,
    rentalStart: string | undefined,
  ): CartStoreResponse {
    const store = stores.get(String(group.storeId));
    const lines = group.items.map((item) =>
      isBundleItem(item)
        ? this.toBundleLine(item, bundles, products, days, rentalStart)
        : this.toProductLine(
            item,
            products.get(String(item.productId)),
            days,
            rentalStart,
          ),
    );
    const itemsTotal = sumMoney(lines.map((line) => line.lineTotal.amount));
    const deliveryCost = money(deliveryEuros(group, store));
    return {
      storeId: String(group.storeId),
      storeName: store?.name ?? '',
      acquisition: toHandoffResponse(group.acquisition),
      devolution: toHandoffResponse(group.devolution),
      products: lines,
      itemsTotal,
      deliveryCost,
      total: money(itemsTotal.amount + deliveryCost.amount),
    };
  }

  private toProductLine(
    item: CartItem,
    product: ProductLean | undefined,
    days: number,
    rentalStart: string | undefined,
  ): CartLineResponse {
    if (!product) {
      return unavailableLine('product', String(item.productId ?? ''), item);
    }
    const daily = effectiveDailyPrice(product.price, rentalStart);
    const media = product.medias?.[0];
    const available = product.status === 'available';
    return {
      kind: 'product',
      id: String(product._id),
      title: product.title,
      price: money(daily),
      lineTotal: money(available ? daily * days : 0),
      media: media ? this.mediaUrl(media) : null,
      accessories: accessoryOptions(product),
      selectedAccessories: item.accessories ?? [],
      isAvailable: available,
    };
  }

  private toBundleLine(
    item: CartItem,
    bundles: Map<string, BundleLean>,
    products: Map<string, ProductLean>,
    days: number,
    rentalStart: string | undefined,
  ): CartLineResponse {
    const bundle = item.bundleId
      ? bundles.get(String(item.bundleId))
      : undefined;
    if (!bundle) {
      return unavailableLine('bundle', String(item.bundleId ?? ''), item);
    }
    const members = (bundle.productIds ?? [])
      .map((id) => products.get(String(id)))
      .filter((product): product is ProductLean => Boolean(product));
    const daily = effectiveDailyPrice(bundle.price, rentalStart);
    const available =
      bundle.status === 'available' &&
      members.length === (bundle.productIds ?? []).length &&
      members.every((product) => product.status === 'available');
    const cover = members.find((product) => product.medias?.[0])?.medias?.[0];
    return {
      kind: 'bundle',
      id: String(bundle._id),
      title: bundle.title,
      price: money(daily),
      lineTotal: money(available ? daily * days : 0),
      media: cover ? this.mediaUrl(cover) : null,
      accessories: [],
      selectedAccessories: [],
      isAvailable: available,
      products: members.map((product) => ({
        id: String(product._id),
        title: product.title,
        category: product.category,
      })),
    };
  }

  private mediaUrl(media: ProductMedia): string {
    return this.storage.imageUrls(media.publicId, media.url).card || media.url;
  }
}

function emptyCart(): CartResponse {
  return {
    city: null,
    country: null,
    tax: money(0),
    days: 0,
    rentalPeriod: null,
    productsByStore: [],
    totals: zeroTotals(0),
  };
}

function money(amount: number): CartMoney {
  return { currency: CURRENCY, amount: Math.round(amount * 100) / 100 };
}

function unavailableLine(
  kind: 'product' | 'bundle',
  id: string,
  item: CartItem,
): CartLineResponse {
  return {
    kind,
    id,
    title: '',
    price: money(0),
    lineTotal: money(0),
    media: null,
    accessories: [],
    selectedAccessories: kind === 'product' ? (item.accessories ?? []) : [],
    isAvailable: false,
  };
}

function cartTotals(
  stores: CartStoreResponse[],
  days: number,
  taxAmount: number,
): CartTotals {
  const itemsAmount = sumMoney(
    stores.map((store) => store.itemsTotal.amount),
  ).amount;
  const deliveryAmount = sumMoney(
    stores.map((store) => store.deliveryCost.amount),
  ).amount;
  const tax = money(taxAmount).amount;
  return {
    currency: CURRENCY,
    days,
    itemsAmount,
    deliveryAmount,
    taxAmount: tax,
    amount: money(itemsAmount + deliveryAmount + tax).amount,
  };
}

function zeroTotals(days: number): CartTotals {
  return {
    currency: CURRENCY,
    days,
    itemsAmount: 0,
    deliveryAmount: 0,
    taxAmount: 0,
    amount: 0,
  };
}

function sumMoney(amounts: number[]): CartMoney {
  return money(amounts.reduce((sum, amount) => sum + amount, 0));
}

function rentalDays(period?: { start: string; end: string }): number {
  if (!period?.start || !period.end) return 0;
  const start = Date.parse(`${period.start}T00:00:00Z`);
  const end = Date.parse(`${period.end}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.round((end - start) / 86_400_000) + 1;
}

function isBundleItem(item: CartItem): boolean {
  return item.kind === 'bundle' || Boolean(item.bundleId);
}

function sameLine(current: CartItem, next: CartItem): boolean {
  if (isBundleItem(next))
    return String(current.bundleId) === String(next.bundleId);
  return (
    !isBundleItem(current) &&
    String(current.productId) === String(next.productId)
  );
}

function lineIdSet(ids: string[]): Set<string> {
  const drop = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim().toLowerCase();
    if (!id) continue;
    if (!/^[a-f0-9]{24}$/.test(id)) {
      throw new BadRequestException({ error: 'invalid_item_id', id: raw });
    }
    drop.add(id);
  }
  return drop;
}

function itemLineId(item: CartItem): string {
  const raw = isBundleItem(item) ? item.bundleId : item.productId;
  return raw ? String(raw).toLowerCase() : '';
}

function findProductItem(
  cart: CartDocument,
  productId: string,
): CartItem | undefined {
  for (const group of cart.stores) {
    const item = group.items.find(
      (entry) => !isBundleItem(entry) && String(entry.productId) === productId,
    );
    if (item) return item;
  }
  return undefined;
}

function findBundleItem(
  cart: CartDocument,
  bundleId: string,
): CartItem | undefined {
  for (const group of cart.stores) {
    const item = group.items.find(
      (entry) => isBundleItem(entry) && String(entry.bundleId) === bundleId,
    );
    if (item) return item;
  }
  return undefined;
}

function itemCount(cart: CartDocument | null): number {
  if (!cart) return 0;
  return cart.stores.reduce((sum, group) => sum + group.items.length, 0);
}

function accessoryOptions(product: ProductLean): string[] {
  const value = product.attributes?.accessories;
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function effectiveDailyPrice(
  price: ProductPrice | undefined,
  rentalStart: string | undefined,
): number {
  if (!price) return 0;
  if (price.offer === undefined) return price.list;
  if (!rentalStart || !price.activeFrom || !price.activeUntil)
    return price.offer;
  if (rentalStart >= price.activeFrom && rentalStart <= price.activeUntil) {
    return price.offer;
  }
  return price.list;
}

function deliveryEuros(
  group: CartStoreGroup,
  store: StoreLean | undefined,
): number {
  if (group.acquisition?.type !== 'delivery') return 0;
  const cents = store?.delivery?.basePrice ?? 0;
  return Math.round(cents) / 100;
}

type CartLineInput = {
  productId?: string;
  bundleId?: string;
  accessories?: string[];
};

function resolveCartInputs(dto: AddCartItemDto): CartLineInput[] {
  const products = dto.productIds ?? [];
  const bundles = (dto.bundleIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (products.length || bundles.length) {
    return [
      ...products.map((entry: CartProductInputDto) => ({
        productId: entry.id,
        accessories: entry.accessories,
      })),
      ...bundles.map((bundleId) => ({ bundleId })),
    ];
  }
  const hasProduct = Boolean(dto.productId?.trim());
  const hasBundle = Boolean(dto.bundleId?.trim());
  if (hasProduct === hasBundle) {
    throw new BadRequestException({
      error: 'invalid_cart_item',
      message: 'Send productId, bundleId, productIds, or bundleIds',
    });
  }
  return [
    {
      productId: dto.productId,
      bundleId: dto.bundleId,
      accessories: dto.accessories,
    },
  ];
}

function parseObjectId(value: string, error: string): string {
  const id = value.trim();
  if (!Types.ObjectId.isValid(id)) {
    throw new BadRequestException({ error });
  }
  return id;
}

function parsePeriod(
  startRaw: string,
  endRaw: string,
): { start: string; end: string } {
  const start = parseDate(startRaw, 'start');
  const end = parseDate(endRaw, 'end');
  if (start > end) {
    throw new BadRequestException({
      error: 'invalid_rental_period',
      message: 'start must be before or equal to end',
    });
  }
  return { start, end };
}

function parseDate(value: string, field: string): string {
  const raw = value.trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (dmy) {
    day = Number(dmy[1]);
    month = Number(dmy[2]);
    year = Number(dmy[3]);
  } else {
    throw new BadRequestException({
      error: 'invalid_date',
      field,
      message: 'Use YYYY-MM-DD or DD/MM/YYYY',
    });
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException({ error: 'invalid_date', field });
  }
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

function toDmy(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

function pad(value: number, size: number): string {
  return value.toString().padStart(size, '0');
}

function normalizeHandoff(dto: CartHandoffDto): CartHandoff {
  const type: CartHandoffType =
    dto.type === 'customer-pickup' ? 'customer_pickup' : dto.type;
  const address = dto.address?.trim();
  if (type === 'delivery' && !address) {
    throw new BadRequestException({
      error: 'address_required',
      message: 'delivery requires address',
    });
  }
  return {
    type,
    ...(address ? { address } : {}),
    ...(dto.time !== undefined ? { time: dto.time } : {}),
  };
}

function toHandoffResponse(handoff: CartHandoff): CartHandoffResponse {
  return {
    type: handoff.type,
    ...(handoff.address ? { address: handoff.address } : {}),
    ...(handoff.time !== undefined ? { time: handoff.time } : {}),
  };
}
