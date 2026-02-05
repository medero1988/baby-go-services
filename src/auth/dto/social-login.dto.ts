import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class FacebookLoginDto {
  @IsString()
  @IsNotEmpty()
  accessToken: string;
}
