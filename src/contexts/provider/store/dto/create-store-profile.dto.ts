import { IsString, IsNotEmpty, MaxLength, Matches } from 'class-validator';

export class CreateStoreProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10)
  country: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9\s-]+$/, {
    message: 'cellPhone must be a valid phone number',
  })
  @MaxLength(20)
  cellPhone: string;
}
