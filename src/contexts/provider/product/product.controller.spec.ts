import {
  INestApplication,
  RequestMethod,
  ValidationPipe,
} from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import type { App } from 'supertest/types';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

describe('ProductController routes', () => {
  const proto = ProductController.prototype as unknown as Record<
    string,
    unknown
  >;
  const routes = Object.getOwnPropertyNames(proto)
    .filter((name) => name !== 'constructor')
    .map((name) => proto[name])
    .filter((fn): fn is object => typeof fn === 'function')
    .filter((fn) => Reflect.getMetadata(PATH_METADATA, fn) !== undefined)
    .map((fn) => ({
      method: Reflect.getMetadata(METHOD_METADATA, fn) as RequestMethod,
      path: String(Reflect.getMetadata(PATH_METADATA, fn)),
    }));

  it('does not expose POST /:id/save', () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.some((r) => r.path.includes('save'))).toBe(false);
    expect(proto.save).toBeUndefined();
  });

  it('registers PUT /:id/medias/order before PUT /:id/medias/:mediaId', () => {
    const order = routes.findIndex(
      (r) => r.method === RequestMethod.PUT && r.path === '/:id/medias/order',
    );
    const replace = routes.findIndex(
      (r) =>
        r.method === RequestMethod.PUT && r.path === '/:id/medias/:mediaId',
    );
    expect(order).toBeGreaterThanOrEqual(0);
    expect(replace).toBeGreaterThan(order);
  });
});

describe('PUT /products/:id/medias/order (HTTP)', () => {
  const USER_ID = 'user-1';
  const PRODUCT_ID = new Types.ObjectId().toHexString();
  const base = `/${ROUTES.PROVIDER}/products/${PRODUCT_ID}/medias`;
  let app: INestApplication;
  const productService = {
    reorderMedias: jest.fn().mockResolvedValue([]),
    replaceMedia: jest.fn().mockResolvedValue({}),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProductController],
      providers: [{ provide: ProductService, useValue: productService }],
    }).compile();
    app = moduleRef.createNestApplication();
    app.use((req: Request, _res: Response, next: NextFunction) => {
      (req as Request & { user: unknown }).user = { id: USER_ID };
      next();
    });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  it('routes `order` to reorderMedias, not replaceMedia', async () => {
    const mediaIds = [
      new Types.ObjectId().toHexString(),
      new Types.ObjectId().toHexString(),
    ];
    await request(app.getHttpServer() as App)
      .put(`${base}/order`)
      .send({ mediaIds })
      .expect(200);
    expect(productService.reorderMedias).toHaveBeenCalledWith(
      PRODUCT_ID,
      USER_ID,
      mediaIds,
    );
    expect(productService.replaceMedia).not.toHaveBeenCalled();
  });

  it('passes a malformed mediaIds through to the service as-is', async () => {
    await request(app.getHttpServer() as App)
      .put(`${base}/order`)
      .send({ mediaIds: 'nope' })
      .expect(200);
    expect(productService.reorderMedias).toHaveBeenCalledWith(
      PRODUCT_ID,
      USER_ID,
      'nope',
    );
  });

  it('rejects a malformed product id with invalid_product_id', async () => {
    const res = await request(app.getHttpServer() as App)
      .put(`/${ROUTES.PROVIDER}/products/not-an-id/medias/order`)
      .send({ mediaIds: [] })
      .expect(400);
    expect(res.body).toMatchObject({ error: 'invalid_product_id' });
    expect(productService.reorderMedias).not.toHaveBeenCalled();
  });
});
