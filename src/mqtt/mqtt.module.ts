import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { AuthModule } from '../auth/auth.module';
import { MqttMessage } from '../entities/mqtt-message.entity';
import { MqttSubscribedTopic } from '../entities/mqtt-subscribed-topic.entity';
import { MqttConfig } from '../entities/mqtt-config.entity';
import { APP_CONSTANTS } from '../common/constants/app.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([MqttMessage, MqttSubscribedTopic, MqttConfig]),
    forwardRef(() => WebSocketModule),
    AuthModule,
    JwtModule.register({
      secret: APP_CONSTANTS.JWT.SECRET_KEY,
      signOptions: { expiresIn: APP_CONSTANTS.JWT.DEFAULT_EXPIRES_IN },
    }),
  ],
  controllers: [MqttController],
  providers: [MqttService],
  exports: [MqttService],
})
export class MqttModule {}

