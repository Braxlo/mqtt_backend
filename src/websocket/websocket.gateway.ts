import {
  WebSocketGateway as WSGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { MqttService } from '../mqtt/mqtt.service';
import { MqttMessage, MqttConnectionStatus } from '../common/interfaces/mqtt-message.interface';
import { Subscription } from 'rxjs';
import { APP_CONSTANTS } from '../common/constants/app.constants';

@WSGateway({
  cors: {
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true, // Compatibilidad con versiones anteriores
})
export class WebSocketGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(WebSocketGateway.name);
  private mqttSubscription: Subscription | null = null;

  constructor(private readonly mqttService: MqttService) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway inicializado');
    // Suscribirse a los mensajes MQTT y reenviarlos a los clientes WebSocket
    // Esto se hace aquí porque el server ya está inicializado
    this.mqttSubscription = this.mqttService.messageSubject.subscribe(
      (message: MqttMessage) => {
        if (this.server) {
          this.server.emit('mqtt:message', message);
        }
      },
    );
  }

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
    // Enviar estado inicial
    const status = this.mqttService.getConnectionStatus();
    const topics = this.mqttService.getSubscribedTopics();
    client.emit('mqtt:status', {
      ...status,
      subscribedTopics: topics,
    });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('mqtt:subscribe')
  async handleSubscribe(client: Socket, topic: string) {
    this.logger.log(`Cliente ${client.id} solicita suscripción a: ${topic}`);
    const success = await this.mqttService.subscribe(topic);
    if (success) {
      client.emit('mqtt:subscribed', { topic, success: true });
      // Notificar a todos los clientes sobre el cambio
      this.emitStatusUpdate();
    }
  }

  @SubscribeMessage('mqtt:unsubscribe')
  async handleUnsubscribe(client: Socket, topic: string) {
    this.logger.log(`Cliente ${client.id} solicita desuscripción de: ${topic}`);
    const success = await this.mqttService.unsubscribe(topic);
    if (success) {
      client.emit('mqtt:unsubscribed', { topic, success: true });
      // Notificar a todos los clientes sobre el cambio
      this.emitStatusUpdate();
    }
  }

  @SubscribeMessage('mqtt:get-status')
  handleGetStatus(client: Socket) {
    // Enviar estado actual al cliente que lo solicita
    this.emitStatusUpdate();
  }

  /**
   * Emite actualizaciones de estado MQTT a todos los clientes conectados
   */
  emitStatusUpdate() {
    const status: MqttConnectionStatus = this.mqttService.getConnectionStatus();
    this.server.emit('mqtt:status', status);
  }
}

