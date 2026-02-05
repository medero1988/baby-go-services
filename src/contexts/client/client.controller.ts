import { Controller, Get } from '@nestjs/common';
import { ROUTES } from '../../common/constants/api-routes.constants';

/**
 * APIs de cara a clientes.
 * Base: /api/c/v1
 */
@Controller(ROUTES.CLIENT)
export class ClientController {
  @Get('health')
  health() {
    return {
      context: 'client',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
