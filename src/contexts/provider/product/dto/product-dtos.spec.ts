import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListBundlesQueryDto } from '../../bundle/dto/list-bundles-query.dto';
import { CreateProductDto } from './create-product.dto';
import { ListProductsQueryDto } from './list-products-query.dto';
import { UpdateProductDto } from './update-product.dto';

async function categoryErrors(cls: new () => object, category: string) {
  const errors = await validate(plainToInstance(cls, { category }));
  return errors.filter((e) => e.property === 'category');
}

async function statusErrors(cls: new () => object, status: string) {
  const errors = await validate(plainToInstance(cls, { status }));
  return errors.filter((e) => e.property === 'status');
}

describe('UpdateProductDto.status', () => {
  it.each(['available', 'inactive'])('accepts %s', async (status) => {
    expect(await statusErrors(UpdateProductDto, status)).toHaveLength(0);
  });

  it.each(['rented', 'in_review', 'active', 'draft'])(
    'rejects %s',
    async (status) => {
      expect(await statusErrors(UpdateProductDto, status)).toHaveLength(1);
    },
  );
});

describe('ListProductsQueryDto.status', () => {
  it.each(['available', 'rented', 'in_review', 'inactive'])(
    'accepts %s',
    async (status) => {
      expect(await statusErrors(ListProductsQueryDto, status)).toHaveLength(0);
    },
  );

  it.each(['active', 'draft'])('rejects %s', async (status) => {
    expect(await statusErrors(ListProductsQueryDto, status)).toHaveLength(1);
  });
});

describe('category validation', () => {
  const dtos = [CreateProductDto, UpdateProductDto, ListProductsQueryDto];

  describe.each(dtos)('%p', (cls) => {
    it.each(['stroller', 'baby-carrier', 'car-seat', 'crib', 'bike', 'toy'])(
      'accepts %s',
      async (category) => {
        expect(await categoryErrors(cls, category)).toHaveLength(0);
      },
    );

    it.each([
      'babyCarrier',
      'baby_carrier',
      'babycarrier',
      'Stroller',
      'bundle',
    ])('rejects %s', async (category) => {
      expect(await categoryErrors(cls, category)).toHaveLength(1);
    });
  });

  it('ListBundlesQueryDto accepts bundle and product categories', async () => {
    expect(await categoryErrors(ListBundlesQueryDto, 'bundle')).toHaveLength(0);
    expect(await categoryErrors(ListBundlesQueryDto, 'car-seat')).toHaveLength(
      0,
    );
    expect(await categoryErrors(ListBundlesQueryDto, 'carSeat')).toHaveLength(
      1,
    );
  });
});
