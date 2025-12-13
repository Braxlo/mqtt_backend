import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MqttModule } from './mqtt/mqtt.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { BarrerasModule } from './barreras/barreras.module';
import { EscenariosModule } from './escenarios/escenarios.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './common/controllers/health.controller';
import {
  User,
  Barrera,
  Escenario,
  EscenarioTopic,
  MqttMessage,
  MqttSubscribedTopic,
  MqttConfig,
} from './entities';

/**
 * Módulo principal de la aplicación
 */
@Module({
  imports: [
    // Configuración de variables de entorno
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Configuración de TypeORM con PostgreSQL
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'mqtt_centinela'),
        entities: [User, Barrera, Escenario, EscenarioTopic, MqttMessage, MqttSubscribedTopic, MqttConfig],
        synchronize: configService.get<boolean>('DB_SYNCHRONIZE', true),
        logging: configService.get<boolean>('DB_LOGGING', false),
      }),
      inject: [ConfigService],
    }),
    MqttModule,
    WebSocketModule,
    AuthModule,
    BarrerasModule,
    EscenariosModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
