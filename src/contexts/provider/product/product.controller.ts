import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFiles,
  UseInterceptors,
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
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';

const MEDIA_UPLOAD = {
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
};

const MEDIA_FIELD_NAMES = new Set(['media', 'file', 'image', 'photo']);

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

  /** PATCH parcial: title, description, category, price, attributes, status. */
  @Patch('/:id')
  update(
    @Param('id') id: string,
    @Body() body: UpdateProductDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.update(
      this.parseId(id, 'invalid_product_id'),
      user.id,
      body,
    );
  }

  /** Subir foto al bucket (multipart; preferí field `media`). */
  @Post('/:id/medias')
  @UseInterceptors(AnyFilesInterceptor(MEDIA_UPLOAD))
  uploadMedia(
    @Param('id') id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.productService.addMedia(
      this.parseId(id, 'invalid_product_id'),
      user.id,
      pickMediaFile(files),
    );
  }

  /** Reemplazar una foto en el bucket. */
  @Put('/:id/medias/:mediaId')
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
      pickMediaFile(files),
    );
  }

  /** Eliminar una foto (DB + bucket). */
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

  /** Eliminar producto + todas sus medias del bucket. */
  @Delete('/:id')
  @HttpCode(200)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productService.remove(
      this.parseId(id, 'invalid_product_id'),
      user.id,
    );
  }

  /**
   * Save product (pantalla Photos del Miro).
   * Requiere título, descripción, categoría, precio, attributes y ≥1 media → `active`.
   */
  @Post('/:id/save')
  save(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.productService.save(
      this.parseId(id, 'invalid_product_id'),
      user.id,
    );
  }
}

/** Prefiere `media`; si no, primer archivo con field conocido. */
function pickMediaFile(
  files?: Express.Multer.File[],
): Express.Multer.File | undefined {
  if (!files?.length) return undefined;
  return (
    files.find((f) => MEDIA_FIELD_NAMES.has(f.fieldname)) ??
    files.find((f) => f.fieldname === 'media') ??
    files[0]
  );
}
