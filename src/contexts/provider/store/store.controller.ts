import {
  Body,
  Controller,
  Get,
  BadRequestException,
  Post,
  Patch,
  Query,
  Param,
  Delete,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Types } from 'mongoose';
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
 * Store APIs del provider.
 * Requieren Bearer JWT
 * El `userId` sale del token (`user.id`); las rutas con `:id` validan ownership.
 */
@Controller(`${ROUTES.PROVIDER}/store`)
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly paymentService: PaymentService,
  ) {}

  private parseStoreId(id: string): string {
    const storeId = String(id).trim();
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return storeId;
  }

  /** Stores del provider autenticado. */
  @Get()
  getMyStores(@CurrentUser() user: AuthUser) {
    return this.storeService.findAllByOwner(user.id);
  }

  /** Movimientos de pagos de todas las stores del proveedor. */
  @Get('/movements')
  getProviderMovements(
    @Query() query: ProviderMovementsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.paymentService.getProviderMovements(user.id, query);
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

  @Get('/:id/movements')
  getStoreMovements(
    @Param('id') id: string,
    @Query() query: ProviderMovementsQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = this.parseStoreId(id);
    return this.paymentService.getProviderMovements(user.id, {
      ...query,
      storeId,
    });
  }

  @Get('/:id/profile')
  getStoreProfile(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.storeService.findOneById(this.parseStoreId(id), user.id);
  }

  @Patch('/:id/profile')
  async updateStoreProfile(
    @Param('id') id: string,
    @Body() body: UpdateStoreProfileDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.updateProfile(
      this.parseStoreId(id),
      user.id,
      body,
    );
  }

  @Post('/:id/cell-verification')
  async validateCellCode(
    @Body() body: CellVerificationDto,
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.validateCellCode(
      this.parseStoreId(id),
      user.id,
      body.code,
    );
  }

  @Post('/:id/cell-verification/resend')
  async resendCellVerificationCode(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.sendCellVerificationCode(
      this.parseStoreId(id),
      user.id,
    );
  }

  @Post('/:id/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.uploadAvatar(this.parseStoreId(id), user.id, file);
  }

  @Post('/:id/delivery')
  async updateDelivery(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.updateDelivery(
      this.parseStoreId(id),
      user.id,
      body,
    );
  }

  @Post('/:id/delivery-pricing')
  async updateDeliveryPricing(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryPricingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.updateDeliveryPricing(
      this.parseStoreId(id),
      user.id,
      body,
    );
  }

  @Post('/:id/customer-pickup')
  async updateCustomerPickup(
    @Param('id') id: string,
    @Body() body: UpdateCustomerPickupDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.updateCustomerPickup(
      this.parseStoreId(id),
      user.id,
      body,
    );
  }

  @Post('/:id/bank-account')
  async updateBankAccount(
    @Param('id') id: string,
    @Body() body: UpdateBankAccountDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.updateBankAccount(
      this.parseStoreId(id),
      user.id,
      body,
    );
  }

  @Post('/:id/confirmation')
  async confirmStore(
    @Param('id') id: string,
    @Body() body: ConfirmStoreDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.storeService.confirmStore(this.parseStoreId(id), user.id, body);
  }

  @Post('/:id/stripe-connect/account-link')
  createStripeAccountLink(
    @Param('id') id: string,
    @Body() body: CreateStripeAccountLinkDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.stripeConnectService.createAccountLink(
      this.parseStoreId(id),
      user.id,
      body,
    );
  }

  @Get('/:id/stripe-connect/status')
  async syncStripeConnectStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
  ) {
    const storeId = this.parseStoreId(id);
    await this.stripeConnectService.syncConnectStatus(storeId, user.id);
    return this.storeService.findOneById(storeId, user.id);
  }

  @Delete('/:id')
  async deleteStore(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.storeService.remove(this.parseStoreId(id), user.id);
  }
}
