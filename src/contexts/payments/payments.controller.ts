import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ROUTES } from '../../common/constants/api-routes.constants';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';
import { PaymentService } from './payment.service';

@Controller(`${ROUTES.CLIENT}/payments`)
export class PaymentsController {
  constructor(private paymentService: PaymentService) {}

  /** Crea PaymentIntent; el cliente confirma el pago con clientSecret en la app. */
  @Post()
  createPaymentIntent(
    @Body() body: CreatePaymentIntentDto,
    @CurrentUser() user: { _id: string },
  ) {
    return this.paymentService.createPaymentIntent(String(user._id), body);
  }

  @Get(':id')
  getPayment(@Param('id') id: string, @CurrentUser() user: { _id: string }) {
    return this.paymentService.findById(id, String(user._id));
  }

  /** Dev/test: confirma pago con tarjeta test sin frontend. */
  @Post(':id/confirm-test')
  confirmPaymentTest(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    return this.paymentService.confirmPaymentForDev(id, String(user._id));
  }

  /**
   * Servicio completado → transfiere ganancias al provider (store).
   * La comisión queda en la cuenta plataforma (empresa).
   */
  @Post(':id/transfer')
  transferToProvider(
    @Param('id') id: string,
    @CurrentUser() user: { _id: string },
  ) {
    return this.paymentService.transferToProvider(id, String(user._id));
  }
}
