import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ROUTES } from '../../common/constants/api-routes.constants';

/**
 * APIs de cara a clientes.
 * Base: /api/c/v1
 * Rutas con @Public() no requieren login.
 */
@Controller(ROUTES.CLIENT)
export class ClientController {
  @Public()
  @Get('health')
  health() {
    return {
      context: 'client',
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
