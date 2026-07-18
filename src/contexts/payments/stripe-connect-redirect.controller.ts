import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';

/** Landing pages locales para return/refresh de Stripe Connect (dev / Postman). */
@Controller('stripe-connect')
export class StripeConnectRedirectController {
  @Public()
  @Get('return')
  onboardingReturn() {
    return {
      ok: true,
      step: 'return',
      message:
        'Onboarding Stripe completado. Volvé a Postman y ejecutá GET stripe-connect/status, luego POST /payments.',
    };
  }

  @Public()
  @Get('refresh')
  onboardingRefresh() {
    return {
      ok: true,
      step: 'refresh',
      message:
        'El link de onboarding expiró. Volvé a Postman y ejecutá de nuevo POST stripe-connect/account-link.',
    };
  }
}
