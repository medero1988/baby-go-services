import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { StoreService } from '../store/store.service';
import { ListProviderOrdersQueryDto } from './dto/list-provider-orders-query.dto';
import {
  buildStatusCounts,
  centsToUnits,
  parseProviderOrdersQuery,
} from './order-query';
import { Order, OrderDocument } from './order.schema';
import {
  ProviderOrderListItem,
  ProviderOrderListResponse,
} from './order.types';

@Injectable()
export class OrderService {
  constructor(
    @InjectModel(Order.name)
    private readonly orderModel: Model<OrderDocument>,
    private readonly storeService: StoreService,
  ) {}

  /**
   * Pedidos de la store del provider (token), más recientes primero.
   * `counts` cubre todos los estados, independiente del filtro `status`.
   */
  async listForProvider(
    userId: string,
    rawQuery: ListProviderOrdersQueryDto,
  ): Promise<ProviderOrderListResponse> {
    const { statuses, limit, offset } = parseProviderOrdersQuery(rawQuery);
    const storeId = await this.storeService.getStoreIdForProvider(userId);
    const storeObjectId = new Types.ObjectId(storeId);

    const filter: QueryFilter<OrderDocument> = { storeId: storeObjectId };
    if (statuses.length) {
      filter.status = { $in: statuses };
    }

    const [docs, countRows] = await Promise.all([
      this.orderModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        // Uno extra para saber si hay página siguiente.
        .limit(limit + 1)
        .lean()
        .exec(),
      this.orderModel
        .aggregate<{
          _id: string;
          count: number;
        }>([
          { $match: { storeId: storeObjectId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;

    return {
      data: page.map((doc) => toListItem(doc as OrderDocument)),
      nextPage: hasMore ? { offset: offset + page.length } : null,
      counts: buildStatusCounts(countRows),
    };
  }
}

export function toListItem(
  doc: Pick<
    OrderDocument,
    | '_id'
    | 'code'
    | 'title'
    | 'startingDate'
    | 'endingDate'
    | 'timeOfReturn'
    | 'price'
    | 'media'
    | 'createdAt'
    | 'status'
  >,
): ProviderOrderListItem {
  return {
    id: String(doc._id),
    code: doc.code,
    title: doc.title,
    startingDate: doc.startingDate,
    endingDate: doc.endingDate,
    timeOfReturn: doc.timeOfReturn,
    price: centsToUnits(doc.price),
    media: doc.media ?? null,
    creationDate: doc.createdAt
      ? new Date(doc.createdAt).toISOString()
      : new Date(0).toISOString(),
    status: doc.status,
  };
}
