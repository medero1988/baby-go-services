import {
  Body,
  Controller,
  Post,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import { CreateStoreProfileDto } from './dto/create-store-profile.dto';
import { StoreService } from './store.service';

/**
 * Store funnel API (proveedores).
 * POST /api/p/v1/store-funnel?steep=profile
 */
@Controller(ROUTES.PROVIDER)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post('store-funnel')
  async storeFunnel(
    @Query('steep') steep: string,
    @Body() body: CreateStoreProfileDto,
  ) {
    if (steep !== 'profile') {
      throw new BadRequestException({ error: 'unsupported_steep' });
    }
    return this.storeService.createProfile(body);
  }
}
