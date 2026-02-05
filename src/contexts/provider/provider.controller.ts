import { Controller, Get } from '@nestjs/common';
import { ROUTES } from '../../common/constants/api-routes.constants';

/**
 * APIs de cara a proveedores.
 * Base: /api/p/v1
 */
@Controller(ROUTES.PROVIDER)
export class ProviderController {
  @Get('health')
  health() {
    return {
      context: 'provider',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
