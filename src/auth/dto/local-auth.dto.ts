import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class EmailVerificationDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}

export class ResendEmailCodeDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;
}

export class PasswordRecoveryDto {
  @IsEmail()
  email: string;
}

export class ResendPasswordRecoveryDto {
  @IsEmail()
  email: string;
}

export class NewPasswordDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  recoveryCode: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class RefreshAccessDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class DeleteAccountByEmailDto {
  @IsEmail()
  email: string;
}
