import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BarrerasService } from './barreras.service';
import { BarrerasController } from './barreras.controller';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { Barrera } from '../entities/barrera.entity';

/**
 * Módulo de gestión de barreras
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Barrera]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [BarrerasController],
  providers: [BarrerasService],
  exports: [BarrerasService],
})
export class BarrerasModule {}

