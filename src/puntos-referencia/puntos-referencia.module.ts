import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PuntosReferenciaService } from './puntos-referencia.service';
import { PuntosReferenciaController } from './puntos-referencia.controller';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { PuntoReferencia } from '../entities/punto-referencia.entity';

/**
 * Módulo de gestión de puntos de referencia HKN
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([PuntoReferencia]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [PuntosReferenciaController],
  providers: [PuntosReferenciaService],
  exports: [PuntosReferenciaService],
})
export class PuntosReferenciaModule {}
