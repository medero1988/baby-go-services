import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class SupportedCountryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  code: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[0-9]+$/, { message: 'phoneCode must be a valid phone code' })
  @MaxLength(10)
  phoneCode: string;
}
