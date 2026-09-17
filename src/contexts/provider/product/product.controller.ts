import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Body,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { Types } from 'mongoose';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import type { AuthUser } from '../../../auth/auth-user';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { ProductService } from './product.service';

const MEDIA_UPLOAD = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
};

/** Multipart no pasa por el ValidationPipe global (forbidNonWhitelisted rompe form-data). */
const MultipartPipe = new ValidationPipe({
  whitelist: false,
  forbidNonWhitelisted: false,
  transform: true,
});

/**
 * Productos del provider.
 * Bearer JWT + role `provider`. Ownership por token (userId del producto/store).
 */
@Controller(`${ROUTES.PROVIDER}/products`)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  private parseId(id: string, error: string): string {
    const value = String(id).trim();
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException({ error });
    }
    return value;
  }

  /** Productos de la store del provider (token). Paginado: page, limit. */
  @Get()
  list(@Query() query: ListProductsQueryDto, @CurrentUser() user: AuthUser) {
    return this.productService.findAllByOwner(user.id, query);
  }

  /** Detalle de un producto propio. */
  @Get('/:id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productService.findOneByOwner(
      this.parseId(id, 'invalid_product_id'),
      user.id,
    );
  }

  /** Crear producto (info + attributes libres). */
  @Post()
  create(@Body() body: CreateProductDto, @CurrentUser() user: AuthUser) {
    return this.productService.create(user.id, body);
  }

  /** Subir foto (multipart; field `media`, `file`, `image` o `photo`). */
  @Post('/:id/medias')
  @UsePipes(MultipartPipe)
  @UseInterceptors(AnyFilesInterceptor(MEDIA_UPLOAD))
  uploadMedia(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.addMedia(
      this.parseId(id, 'invalid_product_id'),
      user.id,
      files?.[0],
    );
  }

  /** Reemplazar una foto. */
  @Put('/:id/medias/:mediaId')
  @UsePipes(MultipartPipe)
  @UseInterceptors(AnyFilesInterceptor(MEDIA_UPLOAD))
  replaceMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.replaceMedia(
      this.parseId(id, 'invalid_product_id'),
      this.parseId(mediaId, 'invalid_media_id'),
      user.id,
      files?.[0],
    );
  }

  /** Eliminar una foto. */
  @Delete('/:id/medias/:mediaId')
  @HttpCode(200)
  deleteMedia(
    @Param('id') id: string,
    @Param('mediaId') mediaId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.deleteMedia(
      this.parseId(id, 'invalid_product_id'),
      this.parseId(mediaId, 'invalid_media_id'),
      user.id,
    );
  }

  /**
   * Save product (pantalla Photos del Miro).
   * Requiere ≥1 media → status `active`.
   */
  @Post('/:id/save')
  save(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productService.save(
      this.parseId(id, 'invalid_product_id'),
      user.id,
    );
  }
}
