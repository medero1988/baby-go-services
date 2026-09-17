import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { EnvService } from '../../config/env.service';

interface RequestWithApiToken {
  headers: { 'x-api-token'?: string };
}

@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly env: EnvService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithApiToken>();
    const receivedToken = request.headers?.['x-api-token'];

    if (!this.isValidToken(receivedToken)) {
      throw new UnauthorizedException('Invalid or missing API token');
    }

    return true;
  }

  private isValidToken(receivedToken?: string): boolean {
    const configuredToken = this.env.apiToken;
    if (!configuredToken || !receivedToken) {
      return false;
    }

    const expected = Buffer.from(configuredToken);
    const received = Buffer.from(receivedToken);
    return (
      expected.length === received.length && timingSafeEqual(expected, received)
    );
  }
}