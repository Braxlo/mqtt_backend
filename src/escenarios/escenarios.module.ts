import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscenariosService } from './escenarios.service';
import { EscenariosController } from './escenarios.controller';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import { Escenario, EscenarioTopic } from '../entities';

/**
 * Módulo de gestión de escenarios
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Escenario, EscenarioTopic]),
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [EscenariosController],
  providers: [EscenariosService],
  exports: [EscenariosService],
})
export class EscenariosModule {}

