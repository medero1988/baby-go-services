import { Body, Controller, Delete, Get, HttpCode, Post } from '@nestjs/common';
import { ROUTES } from '../common/constants/api-routes.constants';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { AuthService } from './auth.service';
import {
  CreateAccountDto,
  DeleteAccountByEmailDto,
  EmailVerificationDto,
  LoginDto,
  LogoutDto,
  NewPasswordDto,
  PasswordRecoveryDto,
  RefreshAccessDto,
  ResendEmailCodeDto,
  ResendPasswordRecoveryDto,
} from './dto/local-auth.dto';
import { FacebookLoginDto, GoogleLoginDto } from './dto/social-login.dto';

/**
 * Auth local + social.
 * Base: /api/v1/auth/...
 */
@Controller(`${ROUTES.COMMON}/auth`)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ——— Social (public) ———

  @Public()
  @Post('google')
  google(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Public()
  @Post('facebook')
  facebook(@Body() dto: FacebookLoginDto) {
    return this.authService.loginWithFacebook(dto.accessToken);
  }

  // ——— Local account ———

  @Public()
  @Post('account')
  createAccount(@Body() dto: CreateAccountDto) {
    return this.authService.createAccount(dto);
  }

  @Get('account')
  getAccount(@CurrentUser() user: { _id: string }) {
    return this.authService.findAccount(String(user._id));
  }

  /** Elimina la cuenta del usuario autenticado (y stores/refresh tokens). */
  @Delete('account')
  deleteAccount(@CurrentUser() user: { _id: string }) {
    return this.authService.deleteAccount(String(user._id));
  }

  /**
   * Solo pruebas (no production): borra cuenta local por email sin JWT.
   * Útil para limpiar datos tras create/verify.
   */
  @Public()
  @Post('account/delete-test')
  @HttpCode(200)
  deleteAccountForTests(@Body() dto: DeleteAccountByEmailDto) {
    return this.authService.deleteAccountByEmailForTests(dto.email);
  }

  @Public()
  @Post('email-verification')
  verifyEmail(@Body() dto: EmailVerificationDto) {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Post('resend-email-code')
  @HttpCode(200)
  resendEmailCode(@Body() dto: ResendEmailCodeDto) {
    return this.authService.resendEmailCode(dto.accountId);
  }

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.loginLocal(dto);
  }

  @Post('logout')
  @HttpCode(200)
  logout(@Body() dto: LogoutDto, @CurrentUser() user: { _id: string }) {
    return this.authService.logout(String(user._id), dto.refreshToken);
  }

  @Public()
  @Post('access-refresh')
  refresh(@Body() dto: RefreshAccessDto) {
    return this.authService.refreshAccess(dto.refreshToken);
  }

  @Public()
  @Post('password-recovery')
  @HttpCode(200)
  passwordRecovery(@Body() dto: PasswordRecoveryDto) {
    return this.authService.requestPasswordRecovery(dto.email);
  }

  @Public()
  @Post('resend-password-recovery')
  @HttpCode(200)
  resendPasswordRecovery(@Body() dto: ResendPasswordRecoveryDto) {
    return this.authService.requestPasswordRecovery(dto.email);
  }

  @Public()
  @Post('new-password')
  @HttpCode(200)
  newPassword(@Body() dto: NewPasswordDto) {
    return this.authService.setNewPassword(dto);
  }
}
