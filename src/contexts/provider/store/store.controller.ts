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
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryPricingDto } from './dto/update-delivery-pricing.dto';
import { UpdateStoreProfileDto } from './dto/update-store-profile.dto';
import { StoreService } from './store.service';

@Controller(`${ROUTES.PROVIDER}/store`)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Get()
  getAllStores() {
    return this.storeService.findAll();
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

  @Delete('/:id')
  async deleteStore(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    const userId = String(user._id);
    return this.storeService.remove(id, userId);
  }
}
