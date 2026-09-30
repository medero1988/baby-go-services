import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import type { AuthUser } from '../../../auth/auth-user';
import { ListProviderOrdersQueryDto } from './dto/list-provider-orders-query.dto';
import { OrderService } from './order.service';

/**
 * Pedidos recibidos por la store del provider.
 * Bearer JWT (guard global). Store resuelta por token.
 */
@Controller(`${ROUTES.PROVIDER}/provider-orders`)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /** ?status=pending[,accepted...]&limit=20&offset=0 */
  @Get()
  list(
    @Query() query: ListProviderOrdersQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.orderService.listForProvider(user.id, query);
  }
}
