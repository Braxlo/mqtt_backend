import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { User } from '../entities/user.entity';

/**
 * Módulo de gestión de usuarios
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

