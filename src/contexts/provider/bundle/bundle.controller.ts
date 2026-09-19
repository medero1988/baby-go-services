import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Body,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import type { AuthUser } from '../../../auth/auth-user';
import { CreateBundleDto } from './dto/create-bundle.dto';
import { ListBundlesQueryDto } from './dto/list-bundles-query.dto';
import { UpdateBundleDto } from './dto/update-bundle.dto';
import { BundleService } from './bundle.service';

/**
 * Bundles del provider (combo de ≥2 productos propios).
 * Bearer JWT. Ownership por token.
 */
@Controller(`${ROUTES.PROVIDER}/bundles`)
export class BundleController {
  constructor(private readonly bundleService: BundleService) {}

  private parseId(id: string, error: string): string {
    const value = String(id).trim();
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({ error });
    }
    return value;
  }

  @Get()
  list(@Query() query: ListBundlesQueryDto, @CurrentUser() user: AuthUser) {
    return this.bundleService.findAllByOwner(user.id, query);
  }

  @Get('/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bundleService.findOneByOwner(
      this.parseId(id, 'invalid_bundle_id'),
      user.id,
    );
  }

  @Post()
  create(@Body() body: CreateBundleDto, @CurrentUser() user: AuthUser) {
    return this.bundleService.create(user.id, body);
  }

  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateBundleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.bundleService.update(
      this.parseId(id, 'invalid_bundle_id'),
      user.id,
      body,
    );
  }

  @Post('/:id/save')
  save(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bundleService.save(
      this.parseId(id, 'invalid_bundle_id'),
      user.id,
    );
  }

  @Delete('/:id')
  @HttpCode(200)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.bundleService.remove(
      this.parseId(id, 'invalid_bundle_id'),
      user.id,
    );
  }
}
