import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { EnvService } from '../config/env.service';
import { User, UserSchema } from './user.schema';
import { RefreshToken, RefreshTokenSchema } from './refresh-token.schema';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { Store, StoreSchema } from '../contexts/provider/store/store.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: Store.name, schema: StoreSchema },
    ]),
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
