import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  MinLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { UserRole } from '../user.schema';

@ValidatorConstraint({ name: 'MatchPasswords', async: false })
export class MatchPasswordsConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments): boolean {
    const obj = args.object as { password?: string };
    return confirmPassword === obj.password;
  }

  defaultMessage(): string {
    return 'passwordConfirmation must match password';
  }
}

@ValidatorConstraint({ name: 'MatchNewPasswords', async: false })
export class MatchNewPasswordsConstraint implements ValidatorConstraintInterface {
  validate(confirmPassword: string, args: ValidationArguments): boolean {
    const obj = args.object as { newPassword?: string };
    return confirmPassword === obj.newPassword;
  }

  defaultMessage(): string {
    return 'confirmPassword must match newPassword';
  }
}

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

  @IsString()
  @MinLength(8)
  @Validate(MatchPasswordsConstraint)
  passwordConfirmation: string;

  @IsIn(['client', 'provider'])
  role: UserRole;
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

  @IsString()
  @MinLength(8)
  @Validate(MatchNewPasswordsConstraint)
  confirmPassword: string;
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
