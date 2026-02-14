import {
  Body,
  Controller,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import {
  CellVerificationDto,
  SendCellCodeDto,
} from './dto/cell-verification.dto';
import { CreateStoreProfileDto } from './dto/create-store-profile.dto';
import { StoreService } from './store.service';

/**
 * Store funnel API (proveedores).
 * - POST ?steep=profile -> crear tienda (body: name, country, address, cellPhone)
 * - POST ?steep=send-cell-code -> enviar código SMS (body: { id } store id)
 * - POST ?steep=cell-verification -> validar código (body: { id, code }) -> cellValidated: true
 */
@Controller(ROUTES.PROVIDER)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post('store-funnel')
  async storeFunnel(
    @Query('steep') steep: string,
    @Body() body: CreateStoreProfileDto | SendCellCodeDto | CellVerificationDto,
    @CurrentUser() user: { _id: string },
  ) {
    const userId = String(user._id);

    if (steep === 'profile') {
      return this.storeService.createProfile(
        userId,
        body as CreateStoreProfileDto,
      );
    }

    if (steep === 'send-cell-code') {
      const dto = body as SendCellCodeDto;
      return this.storeService.sendCellVerificationCode(dto.id, userId);
    }

    if (steep === 'cell-verification') {
      const dto = body as CellVerificationDto;
      return this.storeService.validateCellCode(dto.id, userId, dto.code);
    }

    throw new BadRequestException({ error: 'unsupported_steep' });
  }
}
