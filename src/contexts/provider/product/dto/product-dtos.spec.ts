import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListProductsQueryDto } from './list-products-query.dto';
import { UpdateProductDto } from './update-product.dto';

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
