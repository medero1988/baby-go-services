import { IsOptional, IsUrl } from 'class-validator';

export class CreateStripeAccountLinkDto {
  /** URL http(s) de retorno tras onboarding (opcional, usa env por defecto). */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  returnUrl?: string;

  /** URL http(s) si expira el link de onboarding (opcional, usa env por defecto). */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  refreshUrl?: string;
}
