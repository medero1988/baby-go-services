import {
  Controller,
  Headers,
  Post,
  RawBodyRequest,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { StripeService } from '../../shared/stripe/stripe.service';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private stripe: StripeService,
    private webhookService: StripeWebhookService,
  ) {}

  @Public()
  @Post()
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody;
    if (!rawBody || !signature) {
      throw new BadRequestException({ error: 'missing_webhook_payload' });
    }
    const event = this.stripe.constructWebhookEvent(rawBody, signature);
    await this.webhookService.handleEvent(event);
    return { received: true };
  }
}
