import { IsString, IsNotEmpty, MaxLength, MinLength } from 'class-validator';

export class SendCellCodeDto {
  @IsString()
  @IsNotEmpty()
  id: string;
}

export class CellVerificationDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(8)
  code: string;
}
