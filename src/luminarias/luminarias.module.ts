import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LuminariasService } from './luminarias.service';
import { LuminariasController } from './luminarias.controller';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { Luminaria } from '../entities/luminaria.entity';

/**
 * Módulo de gestión de luminarias
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Luminaria]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [LuminariasController],
  providers: [LuminariasService],
  exports: [LuminariasService],
})
export class LuminariasModule {}

