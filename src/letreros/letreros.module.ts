import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LetrerosService } from './letreros.service';
import { LetrerosController } from './letreros.controller';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { Letrero } from '../entities/letrero.entity';

/**
 * Módulo de gestión de letreros
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Letrero]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [LetrerosController],
  providers: [LetrerosService],
  exports: [LetrerosService],
})
export class LetrerosModule {}
