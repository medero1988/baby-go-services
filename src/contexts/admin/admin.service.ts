import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Bundle, BundleDocument } from '../provider/bundle/bundle.schema';
import { Product, ProductDocument } from '../provider/product/product.schema';
import { ProductStatus } from '../provider/product/product.types';
import { Store, StoreDocument } from '../provider/store/store.schema';

export type AdminStatusResult = {
  providerId: string;
  status: ProductStatus;
  updated: number;
  bundlesUpdated: number;
};

export type AdminApproveResult = {
  approved: number;
  bundlesUpdated: number;
  providerId?: string;
};

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Bundle.name)
    private readonly bundleModel: Model<BundleDocument>,
    @InjectModel(Store.name)
    private readonly storeModel: Model<StoreDocument>,
  ) {}

  async setProviderProductsStatus(
    providerId: string,
    status: ProductStatus,
  ): Promise<AdminStatusResult> {
    await this.requireProvider(providerId);
    const result = await this.productModel
      .updateMany(ownedBy(providerId), { $set: { status } })
      .exec();
    const bundlesUpdated = await this.syncOpenBundles([providerId]);
    return {
      providerId,
      status,
      updated: result.modifiedCount,
      bundlesUpdated,
    };
  }

  async approveProviderProducts(
    providerId: string,
  ): Promise<AdminApproveResult> {
    await this.requireProvider(providerId);
    const result = await this.productModel
      .updateMany(
        { ...ownedBy(providerId), status: 'in_review' },
        { $set: { status: 'available' } },
      )
      .exec();
    const bundlesUpdated = await this.syncOpenBundles([providerId]);
    return {
      providerId,
      approved: result.modifiedCount,
      bundlesUpdated,
    };
  }

  async approveProducts(productIds: string[]): Promise<AdminApproveResult> {
    const ids = uniqueIds(productIds);
    const products = await this.productModel
      .find({ _id: { $in: ids } })
      .select({ status: 1, userId: 1 })
      .lean()
      .exec();

    const present = new Set(products.map((product) => String(product._id)));
    const missing = ids.filter((id) => !present.has(id));
    if (missing.length) {
      throw new NotFoundException({ error: 'products_not_found', missing });
    }

    const notInReview = products
      .filter((product) => product.status !== 'in_review')
      .map((product) => String(product._id));
    if (notInReview.length) {
      throw new BadRequestException({
        error: 'product_not_in_review',
        productIds: notInReview,
      });
    }

    const result = await this.productModel
      .updateMany(
        { _id: { $in: ids }, status: 'in_review' },
        { $set: { status: 'available' } },
      )
      .exec();
    const providerIds = [
      ...new Set(products.map((product) => String(product.userId))),
    ];
    const bundlesUpdated = await this.syncOpenBundles(providerIds);
    return { approved: result.modifiedCount, bundlesUpdated };
  }

  private async requireProvider(providerId: string): Promise<void> {
    const store = await this.storeModel.findOne(ownedBy(providerId)).exec();
    if (!store) {
      throw new NotFoundException({ error: 'provider_not_found' });
    }
  }

  /**
   * Bundles `available` o `in_review` siguen el status de sus productos.
   * `inactive` y `rented` los dejó el provider y no se tocan.
   */
  private async syncOpenBundles(providerIds: string[]): Promise<number> {
    if (!providerIds.length) return 0;
    const bundles = await this.bundleModel
      .find({
        $expr: { $in: [{ $toString: '$userId' }, providerIds] },
        status: { $in: ['available', 'in_review'] },
      })
      .select({ productIds: 1, status: 1 })
      .exec();
    if (!bundles.length) return 0;

    const memberIds = [
      ...new Set(
        bundles.flatMap((bundle) =>
          (bundle.productIds ?? []).map((id) => String(id)),
        ),
      ),
    ];
    const products = memberIds.length
      ? await this.productModel
          .find({ _id: { $in: memberIds } })
          .select({ status: 1 })
          .lean()
          .exec()
      : [];
    const statusById = new Map(
      products.map((product) => [String(product._id), product.status]),
    );

    const ops = bundles.flatMap((bundle) => {
      const next = bundleStatusForMembers(
        (bundle.productIds ?? []).map((id) => statusById.get(String(id))),
      );
      if (next === bundle.status) return [];
      return [
        {
          updateOne: {
            filter: { _id: bundle._id },
            update: { $set: { status: next } },
          },
        },
      ];
    });
    if (!ops.length) return 0;
    const result = await this.bundleModel.bulkWrite(ops);
    return result.modifiedCount;
  }
}

function bundleStatusForMembers(
  statuses: Array<ProductStatus | undefined>,
): ProductStatus {
  if (!statuses.length || statuses.some((status) => status === undefined)) {
    return 'in_review';
  }
  if (statuses.some((status) => status === 'in_review')) return 'in_review';
  const first = statuses[0] as ProductStatus;
  if (statuses.every((status) => status === first)) return first;
  return 'in_review';
}

function ownedBy(userId: string): Record<string, unknown> {
  return { $expr: { $eq: [{ $toString: '$userId' }, userId] } };
}

function uniqueIds(ids: string[]): string[] {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  const invalid = unique.filter((id) => !Types.ObjectId.isValid(id));
  if (!unique.length || invalid.length) {
    throw new BadRequestException({
      error: 'invalid_product_id',
      ...(invalid.length ? { productIds: invalid } : {}),
    });
  }
  return unique;
}
