import { Module, forwardRef } from '@nestjs/common';
import { WebSocketGateway } from './websocket.gateway';
import { MqttModule } from '../mqtt/mqtt.module';

@Module({
  imports: [forwardRef(() => MqttModule)],
  providers: [WebSocketGateway],
  exports: [WebSocketGateway],
})
export class WebSocketModule {}

