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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Types } from 'mongoose';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
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

@Controller(`${ROUTES.PROVIDER}/store`)
export class StoreController {
  constructor(
    private readonly storeService: StoreService,
    private readonly stripeConnectService: StripeConnectService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get()
  getAllStores() {
    return this.storeService.findAll();
  }

  /** Movimientos de pagos de todas las stores del proveedor. */
  @Get('/movements')
  getProviderMovements(
    @Query() query: ProviderMovementsQueryDto,
    @CurrentUser() user: { _id: string },
  ) {
    return this.paymentService.getProviderMovements(String(user._id), query);
  }

  /** Movimientos de pagos de una store puntual del proveedor. */
  @Get('/:id/movements')
  getStoreMovements(
    @Param('id') id: string,
    @Query() query: ProviderMovementsQueryDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.paymentService.getProviderMovements(String(user._id), {
      ...query,
      storeId,
    });
  }

  @Get('/:id/profile')
  getStoreProfile(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.findOneById(storeId, userId);
  }

  @Post('profile')
  async createStore(
    @Query('steep') steep: string,
    @Body() body: CreateStoreProfileDto | SendCellCodeDto | CellVerificationDto,
    @CurrentUser() user: { _id: string },
  ) {
    const userId = String(user._id);

    return this.storeService.createProfile(
      userId,
      body as CreateStoreProfileDto,
    );
  }

  @Patch('/:id/profile')
  async updateStoreProfile(
    @Param('id') id: string,
    @Body() body: UpdateStoreProfileDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.updateProfile(storeId, userId, body);
  }

  @Post('/:id/cell-verification')
  async validateCellCode(
    @Body() body: CellVerificationDto,
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    const userId = String(user._id);
    return this.storeService.validateCellCode(id, userId, body.code);
  }

  @Post('/:id/cell-verification/resend')
  async resendCellVerificationCode(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    const userId = String(user._id);
    return this.storeService.sendCellVerificationCode(id, userId);
  }

  @Post('/:id/avatar')
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }

    return this.storeService.uploadAvatar(storeId, userId, file);
  }

  @Post('/:id/delivery')
  async updateDelivery(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.updateDelivery(storeId, userId, body);
  }

  @Post('/:id/delivery-pricing')
  async updateDeliveryPricing(
    @Param('id') id: string,
    @Body() body: UpdateDeliveryPricingDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.updateDeliveryPricing(storeId, userId, body);
  }

  @Post('/:id/customer-pickup')
  async updateCustomerPickup(
    @Param('id') id: string,
    @Body() body: UpdateCustomerPickupDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.updateCustomerPickup(storeId, userId, body);
  }

  @Post('/:id/bank-account')
  async updateBankAccount(
    @Param('id') id: string,
    @Body() body: UpdateBankAccountDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.updateBankAccount(storeId, userId, body);
  }

  /**
   * Confirmación final del funnel (Create store).
   * Body: `{ "acceptedTerms": true }` → meta.state = pending-review.
   */
  @Post('/:id/confirmation')
  async confirmStore(
    @Param('id') id: string,
    @Body() body: ConfirmStoreDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.storeService.confirmStore(storeId, userId, body);
  }

  @Post('/:id/stripe-connect/account-link')
  createStripeAccountLink(
    @Param('id') id: string,
    @Body() body: CreateStripeAccountLinkDto,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    return this.stripeConnectService.createAccountLink(storeId, userId, body);
  }

  @Get('/:id/stripe-connect/status')
  async syncStripeConnectStatus(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    const storeId = String(id).trim();
    const userId = String(user._id);
    if (!Types.ObjectId.isValid(storeId)) {
      throw new BadRequestException({ error: 'invalid_store_id' });
    }
    await this.stripeConnectService.syncConnectStatus(storeId, userId);
    return this.storeService.findOneById(storeId, userId);
  }

  @Delete('/:id')
  async deleteStore(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    const userId = String(user._id);
    return this.storeService.remove(id, userId);
  }
}
