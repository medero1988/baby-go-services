import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateStripeAccountLinkDto {
  /** URL http(s) de retorno tras onboarding (opcional, usa env por defecto). */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  returnUrl?: string;

  /** URL http(s) si expira el link de onboarding (opcional, usa env por defecto). */
  @IsOptional()
  @IsUrl({ require_tld: false, protocols: ['http', 'https'] })
  refreshUrl?: string;

  /**
   * Deep link de la app (ej. `bbgo://stripe-connect/return`). Se agrega como
   * `?redirect=` a returnUrl/refreshUrl para que esas páginas vuelvan a la app.
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  appRedirectUrl?: string;
}
