import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export type BankAccountType = 'IBAN' | 'NUMBER';
export type BankAccountHolderType = 'individual' | 'company';

/**
 * Datos bancarios (payout) de la store.
 * Según `accountType`: IBAN → campo `iban`; NUMBER → campo `accountNumber`.
 */
export class UpdateBankAccountDto {
  @IsIn(['IBAN', 'NUMBER'])
  accountType: BankAccountType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  /** Código de país ISO-2 (ej. NL, US, GB). */
  @IsString()
  @Length(2, 2)
  country: string;

  /** Moneda ISO (ej. eur, usd). Opcional: se infiere del país si falta. */
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  /** IBAN — requerido cuando accountType = IBAN. */
  @ValidateIf((o: UpdateBankAccountDto) => o.accountType === 'IBAN')
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  iban?: string;

  /** Número de cuenta — requerido cuando accountType = NUMBER. */
  @ValidateIf((o: UpdateBankAccountDto) => o.accountType === 'NUMBER')
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  accountNumber?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  bankName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  swiftCode?: string;

  /** Routing / sort code (ej. US, UK). */
  @IsOptional()
  @IsString()
  @MaxLength(20)
  routingNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @IsOptional()
  @IsIn(['individual', 'company'])
  entityType?: BankAccountHolderType;
}
