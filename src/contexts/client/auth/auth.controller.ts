import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { ROUTES } from '../../../common/constants/api-routes.constants';
import { AuthService } from '../../../auth/auth.service';
import {
  FacebookLoginDto,
  GoogleLoginDto,
} from '../../../auth/dto/social-login.dto';

/**
 * Login social (clientes). Rutas públicas.
 * POST /api/c/v1/auth/google
 * POST /api/c/v1/auth/facebook
 */
@Controller(ROUTES.CLIENT)
@Public()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('auth/google')
  async google(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Post('auth/facebook')
  async facebook(@Body() dto: FacebookLoginDto) {
    return this.authService.loginWithFacebook(dto.accessToken);
  }
}
