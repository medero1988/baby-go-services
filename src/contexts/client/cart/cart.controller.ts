import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { RequireAuth } from '../../../common/decorators/public.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import type { AuthUser } from '../../../auth/auth-user';
import { CartService } from './cart.service';
import {
  AddCartItemDto,
  RemoveCartItemsDto,
  UpdateCartAccessoriesDto,
  UpdateCartDto,
} from './dto/cart.dto';

/**
 * Carrito del cliente. Bearer JWT.
 * Un carrito por usuario. Productos agrupados por store.
 */
@RequireAuth()
@Controller(ROUTES.CLIENT)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get('shopping-cart-count')
  count(@CurrentUser() user: AuthUser) {
    return this.cartService.count(user.id);
  }

  @Get('cart')
  get(@CurrentUser() user: AuthUser) {
    return this.cartService.get(user.id);
  }

  @Post('cart')
  @HttpCode(200)
  add(@Body() body: AddCartItemDto, @CurrentUser() user: AuthUser) {
    return this.cartService.add(user.id, body);
  }

  /** Período (`start`/`end`) y/o entrega-retiro de una store. */
  @Patch('cart')
  update(@Body() body: UpdateCartDto, @CurrentUser() user: AuthUser) {
    return this.cartService.update(user.id, body);
  }

  @Put('cart/:productId/accessories')
  updateAccessories(
    @Param('productId') productId: string,
    @Body() body: UpdateCartAccessoriesDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.cartService.updateAccessories(user.id, productId, body);
  }

  @Delete('cart')
  @HttpCode(200)
  remove(@Body() body: RemoveCartItemsDto, @CurrentUser() user: AuthUser) {
    return this.cartService.remove(user.id, body);
  }
}
