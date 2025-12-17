import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { MqttModule } from './mqtt/mqtt.module';
import { WebSocketModule } from './websocket/websocket.module';
import { AuthModule } from './auth/auth.module';
import { BarrerasModule } from './barreras/barreras.module';
import { LuminariasModule } from './luminarias/luminarias.module';
import { EscenariosModule } from './escenarios/escenarios.module';
import { UsersModule } from './users/users.module';
import { HealthController } from './common/controllers/health.controller';
import {
  User,
  Barrera,
  Luminaria,
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
      useFactory: (configService: ConfigService) => {
        const synchronize = configService.get<boolean>('DB_SYNCHRONIZE', true);
        const logger = new Logger('TypeORM');
        
        if (synchronize) {
          logger.log('🔄 Sincronización automática de tablas HABILITADA');
          logger.warn('⚠️  Las tablas se actualizarán automáticamente según las entidades');
        } else {
          logger.log('📋 Sincronización automática de tablas DESHABILITADA');
          logger.log('   Usa migraciones manuales en producción');
        }
        
        return {
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', 'mqtt_centinela'),
        entities: [User, Barrera, Luminaria, Escenario, EscenarioTopic, MqttMessage, MqttSubscribedTopic, MqttConfig],
          synchronize,
        logging: configService.get<boolean>('DB_LOGGING', false),
        };
      },
      inject: [ConfigService],
    }),
    MqttModule,
    WebSocketModule,
    AuthModule,
    BarrerasModule,
    LuminariasModule,
    EscenariosModule,
    UsersModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger('AppModule');

  constructor(private dataSource: DataSource) {}

  async onModuleInit() {
    try {
      // Esperar un momento para que TypeORM termine de sincronizar
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Verificar conexión a la base de datos
      if (this.dataSource.isInitialized) {
        this.logger.log('✅ Conexión a la base de datos establecida');
        
        // Obtener información de las tablas
        const synchronize = this.dataSource.options.synchronize;
        if (synchronize) {
          this.logger.log('📊 Tablas sincronizadas automáticamente con las entidades');
          this.logger.log(`   Entidades cargadas: ${this.dataSource.entityMetadatas.length}`);
          
          // Mostrar información detallada de cada entidad
          this.dataSource.entityMetadatas.forEach((entity) => {
            const columns = entity.columns.map(col => col.propertyName).join(', ');
            this.logger.log(`   ✓ ${entity.name} (${entity.tableName})`);
            this.logger.log(`     Columnas: ${columns}`);
          });
          
          // Verificar específicamente la tabla mqtt_messages
          const mqttMessageEntity = this.dataSource.entityMetadatas.find(
            e => e.name === 'MqttMessage' || e.tableName === 'mqtt_messages'
          );
          
          if (mqttMessageEntity) {
            const hasUserId = mqttMessageEntity.columns.some(c => c.propertyName === 'userId');
            const hasUsername = mqttMessageEntity.columns.some(c => c.propertyName === 'username');
            
            if (hasUserId && hasUsername) {
              this.logger.log('   ✅ Tabla mqtt_messages actualizada con user_id y username');
            }
          }
        } else {
          this.logger.warn('⚠️  Sincronización automática deshabilitada');
          this.logger.warn('   Las nuevas columnas NO se agregarán automáticamente');
          this.logger.warn('   Ejecuta el script init-database.sql para actualizar manualmente');
        }
      }
    } catch (error) {
      this.logger.error('❌ Error al inicializar la base de datos:', error.message);
      this.logger.error('   Stack:', error.stack);
    }
  }
}
