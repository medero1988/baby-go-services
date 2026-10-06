import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ProductController } from './product.controller';

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
});
