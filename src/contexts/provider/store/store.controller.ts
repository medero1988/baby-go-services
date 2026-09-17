import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Query,
  Delete,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import type { AuthUser } from '../../../auth/auth-user';
import {
  CellVerificationDto,
  SendCellCodeDto,
} from './dto/cell-verification.dto';
import { CreateStoreProfileDto } from './dto/create-store-profile.dto';
import { ConfirmStoreDto } from './dto/confirm-store.dto';
import { UpdateBankAccountDto } from './dto/update-bank-account.dto';
import { UpdateCustomerPickupDto } from './dto/update-customer-pickup.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryPricingDto } from './dto/update-delivery-pricing.dto';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { CreateStripeAccountLinkDto } from '../../payments/dto/create-stripe-account-link.dto';
import { ProviderMovementsQueryDto } from '../../payments/dto/provider-movements-query.dto';
import { StripeConnectService } from '../../payments/stripe-connect.service';
import { PaymentService } from '../../payments/payment.service';
import { StoreService } from './store.service';

/**
 * Store APIs del provider (relación 1:1).
 * Bearer JWT + role `provider`. La store se resuelve siempre desde el token.
 */
@Controller(`${ROUTES.PROVIDER}/store`)
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly paymentService: PaymentService,
  ) {}

  /** Store del provider autenticado. */
  @Get()
  getMyStore(@CurrentUser() user: AuthUser) {
    return this.storeService.findByOwner(user.id);
  }

  @Get('/profile')
  getStoreProfile(@CurrentUser() user: AuthUser) {
    return this.storeService.findByOwner(user.id);
  }

  /** Movimientos de pagos de la store del proveedor. */
  @Get('/movements')
  async getProviderMovements(
    @Query() query: ProviderMovementsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.paymentService.getProviderMovements(user.id, {
      ...query,
      storeId,
    });
  }

  @Post('profile')
  async createStore(
    @Query('steep') steep: string,
    @Body() body: CreateStoreProfileDto | SendCellCodeDto | CellVerificationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.createProfile(
      user.id,
      body as CreateStoreProfileDto,
    );
  }

  @Patch('/profile')
  async updateStoreProfile(
    @Body() body: UpdateStoreProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.updateProfile(storeId, user.id, body);
  }

  @Post('/cell-verification')
  async validateCellCode(
    @Body() body: CellVerificationDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.validateCellCode(storeId, user.id, body.code);
  }

  @Post('/cell-verification/resend')
  async resendCellVerificationCode(@CurrentUser() user: AuthUser) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.sendCellVerificationCode(storeId, user.id);
  }

  @Post('/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.uploadAvatar(storeId, user.id, file);
  }

  @Post('/delivery')
  async updateDelivery(
    @Body() body: UpdateDeliveryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.updateDelivery(storeId, user.id, body);
  }

  @Post('/delivery-pricing')
  async updateDeliveryPricing(
    @Body() body: UpdateDeliveryPricingDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.updateDeliveryPricing(storeId, user.id, body);
  }

  @Post('/customer-pickup')
  async updateCustomerPickup(
    @Body() body: UpdateCustomerPickupDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.updateCustomerPickup(storeId, user.id, body);
  }

  @Post('/bank-account')
  async updateBankAccount(
    @Body() body: UpdateBankAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.updateBankAccount(storeId, user.id, body);
  }

  @Post('/confirmation')
  async confirmStore(
    @Body() body: ConfirmStoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.confirmStore(storeId, user.id, body);
  }

  @Post('/stripe-connect/account-link')
  async createStripeAccountLink(
    @Body() body: CreateStripeAccountLinkDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.stripeConnectService.createAccountLink(storeId, user.id, body);
  }

  @Get('/stripe-connect/status')
  async syncStripeConnectStatus(@CurrentUser() user: AuthUser) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    await this.stripeConnectService.syncConnectStatus(storeId, user.id);
    return this.storeService.findByOwner(user.id);
  }

  @Delete()
  async deleteStore(@CurrentUser() user: AuthUser) {
    const storeId = await this.storeService.getStoreIdForProvider(user.id);
    return this.storeService.remove(storeId, user.id);
  }
}
