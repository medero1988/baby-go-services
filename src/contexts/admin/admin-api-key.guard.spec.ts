import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AdminApiKeyGuard } from './admin-api-key.guard';

function context(key?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers: key === undefined ? {} : { 'x-admin-key': key },
      }),
    }),
  } as ExecutionContext;
}

describe('AdminApiKeyGuard', () => {
  it('rejects when the admin key is not configured', () => {
    const guard = new AdminApiKeyGuard({ adminApiKey: '  ' } as never);
    expect(() => guard.canActivate(context('anything'))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a missing or wrong key', () => {
    const guard = new AdminApiKeyGuard({ adminApiKey: 'secret' } as never);
    expect(() => guard.canActivate(context())).toThrow(UnauthorizedException);
    expect(() => guard.canActivate(context('nope'))).toThrow(
      UnauthorizedException,
    );
  });

  it('accepts the configured key', () => {
    const guard = new AdminApiKeyGuard({ adminApiKey: 'secret' } as never);
    expect(guard.canActivate(context('secret'))).toBe(true);
  });

  it('accepts the key when an empty duplicate header is sent with it', () => {
    const guard = new AdminApiKeyGuard({ adminApiKey: 'secret' } as never);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ headers: { 'x-admin-key': ['', 'secret'] } }),
      }),
    } as ExecutionContext;
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
