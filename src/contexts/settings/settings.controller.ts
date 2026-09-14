import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ROUTES } from '../../common/constants/api-routes.constants';

const APP_CONFIG = {
  supportedCountries: [
    { code: 'NL', phoneCode: '+31' },
    { code: 'ES', phoneCode: '+34' },
    { code: 'IT', phoneCode: '+39' },
    { code: 'DE', phoneCode: '+49' },
    { code: 'BE', phoneCode: '+32' },
    { code: 'UK', phoneCode: '+44' },
    { code: 'PT', phoneCode: '+351' },
    { code: 'FR', phoneCode: '+33' },
  ],
} as const;

@Controller(ROUTES.COMMON)
export class SettingsController {
  @Public()
  @Get('config')
  getConfig() {
    return APP_CONFIG;
  }
}
