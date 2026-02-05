import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { EnvService } from '../config/env.service';
import { User, UserSchema } from './user.schema';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      useFactory: (env: EnvService): JwtModuleOptions =>
        ({
          secret: env.jwtSecret,
          signOptions: { expiresIn: env.jwtExpiresIn },
        }) as JwtModuleOptions,
      inject: [EnvService],
    }),
  ],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
