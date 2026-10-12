import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { EnvService } from '../../config/env.service';

const HEADER = 'x-admin-key';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.env.adminApiKey.trim();
    if (!expected) {
      throw new UnauthorizedException({ error: 'admin_not_configured' });
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const provided = headerValues(request.headers[HEADER]);
    if (!provided.some((value) => safeEqual(value, expected))) {
      throw new UnauthorizedException({ error: 'invalid_admin_api_key' });
    }
    return true;
  }
}

function headerValues(header: string | string[] | undefined): string[] {
  if (!header) return [];
  const list = Array.isArray(header) ? header : [header];
  return list
    .flatMap((value) => value.split(','))
    .map((value) => value.replace(/\s+/g, ''))
    .filter(Boolean);
}

function safeEqual(provided: string, expected: string): boolean {
  const left = createHash('sha256').update(provided).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}
