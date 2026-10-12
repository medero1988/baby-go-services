import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { ROUTES } from '../../common/constants/api-routes.constants';
import { Public } from '../../common/decorators/public.decorator';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { AdminService } from './admin.service';
import {
  ApproveProductsDto,
  SetProviderProductsStatusDto,
} from './dto/admin-products.dto';

/**
 * Gestión de la app. Solo API key (`x-admin-key`), sin JWT.
 */
@Public()
@UseGuards(AdminApiKeyGuard)
@Controller(ROUTES.ADMIN)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /** Deja todos los productos de un provider en un status. */
  @Patch('providers/:providerId/products/status')
  setProviderProductsStatus(
    @Param('providerId') providerId: string,
    @Body() body: SetProviderProductsStatusDto,
  ) {
    return this.adminService.setProviderProductsStatus(
      parseId(providerId, 'invalid_provider_id'),
      body.status,
    );
  }

  /** Aprueba (`in_review` → `available`) todos los productos de un provider. */
  @Post('providers/:providerId/products/approve')
  @HttpCode(200)
  approveProviderProducts(@Param('providerId') providerId: string) {
    return this.adminService.approveProviderProducts(
      parseId(providerId, 'invalid_provider_id'),
    );
  }

  /** Aprueba los productos indicados (`in_review` → `available`). */
  @Post('products/approve')
  @HttpCode(200)
  approveProducts(@Body() body: ApproveProductsDto) {
    return this.adminService.approveProducts(body.productIds);
  }
}

function parseId(id: string, error: string): string {
  const value = String(id).trim();
  if (!Types.ObjectId.isValid(value)) {
    throw new BadRequestException({ error });
  }
  return value;
}
