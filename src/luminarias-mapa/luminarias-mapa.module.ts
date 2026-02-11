import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LuminariasMapaController } from './luminarias-mapa.controller';
import { LuminariasMapaService } from './luminarias-mapa.service';
import { LuminariaMapa } from '../entities/luminaria-mapa.entity';
import { APP_CONSTANTS } from '../common/constants/app.constants';

/**
 * Módulo para gestionar posiciones de luminarias en el mapa
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([LuminariaMapa]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [LuminariasMapaController],
  providers: [LuminariasMapaService],
  exports: [LuminariasMapaService],
})
export class LuminariasMapaModule {}
