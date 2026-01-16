import {
  Controller,
  Post,
  Get,
  Body,
  Delete,
  Put,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Inject,
  forwardRef,
  UseGuards,
  Request,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { MqttService } from './mqtt.service';
import { ConnectBrokerDto } from './dto/connect-broker.dto';
import { PublishMessageDto } from './dto/publish-message.dto';
import { SubscribeTopicDto } from './dto/subscribe-topic.dto';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { ResponseUtil } from '../common/utils/response.util';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('mqtt')
@UseGuards(JwtAuthGuard)
export class MqttController {
  constructor(
    private readonly mqttService: MqttService,
    @Inject(forwardRef(() => WebSocketGateway))
    private readonly wsGateway: WebSocketGateway,
  ) {}

  @Post('connect')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async connect(@Body() connectDto: ConnectBrokerDto) {
    const autoConnect = connectDto.autoConnect !== undefined ? connectDto.autoConnect : true;
    const connected = await this.mqttService.connect(connectDto.brokerUrl, autoConnect);
    
    // Notificar cambio de estado a todos los clientes WebSocket
    setTimeout(() => {
      this.wsGateway.emitStatusUpdate();
    }, 100);

    if (connected) {
      return ResponseUtil.success(
        { brokerUrl: connectDto.brokerUrl, autoConnect },
        'Conectado al broker MQTT exitosamente',
      );
    }
    
    return ResponseUtil.error('Error al conectar al broker MQTT');
  }

  @Post('disconnect')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async disconnect() {
    await this.mqttService.disconnect();
    
    // Notificar cambio de estado a todos los clientes WebSocket
    setTimeout(() => {
      this.wsGateway.emitStatusUpdate();
    }, 100);
    
    return ResponseUtil.success(null, 'Desconectado del broker MQTT');
  }

  @Get('status')
  getStatus() {
    const status = this.mqttService.getConnectionStatus();
    const topics = this.mqttService.getSubscribedTopics();
    return {
      ...status,
      subscribedTopics: topics,
    };
  }

  @Post('subscribe')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async subscribe(@Body() subscribeDto: SubscribeTopicDto) {
    const success = await this.mqttService.subscribe(subscribeDto.topic, subscribeDto.categoria);
    
    // Notificar cambio de topics a todos los clientes WebSocket
    if (success) {
      setTimeout(() => {
        this.wsGateway.emitStatusUpdate();
      }, 100);
      return ResponseUtil.success(
        { topic: subscribeDto.topic, categoria: subscribeDto.categoria },
        `Suscrito al topic: ${subscribeDto.topic}${subscribeDto.categoria ? ` (categoría: ${subscribeDto.categoria})` : ''}`,
      );
    }
    
    return ResponseUtil.error('Error al suscribirse al topic');
  }

  @Delete('subscribe/:topic')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async unsubscribe(@Param('topic') topic: string) {
    const decodedTopic = decodeURIComponent(topic);
    const success = await this.mqttService.unsubscribe(decodedTopic);
    
    // Notificar cambio de topics a todos los clientes WebSocket
    if (success) {
      setTimeout(() => {
        this.wsGateway.emitStatusUpdate();
      }, 100);
      return ResponseUtil.success(
        { topic: decodedTopic },
        `Desuscrito del topic: ${decodedTopic}`,
      );
    }
    
    return ResponseUtil.error('Error al desuscribirse del topic');
  }

  @Put('subscribe/:topic/category')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async updateTopicCategory(
    @Param('topic') topic: string,
    @Body() body: { categoria: 'chancado' | 'luminarias' | 'barreras' | 'otras_barreras' | 'otros' | 'prueba' },
  ) {
    const decodedTopic = decodeURIComponent(topic);
    const success = await this.mqttService.updateTopicCategory(decodedTopic, body.categoria);
    
    if (success) {
      return ResponseUtil.success(
        { topic: decodedTopic, categoria: body.categoria },
        `Categoría actualizada para el topic: ${decodedTopic}`,
      );
    }
    
    return ResponseUtil.error('Error al actualizar la categoría del topic');
  }

  @Post('publish')
  @UseGuards(RolesGuard)
  @Roles('admin', 'operador')
  @HttpCode(HttpStatus.OK)
  publish(@Body() publishDto: PublishMessageDto, @Request() req: ExpressRequest) {
    const user = req['user'] as { username?: string; sub?: number } | undefined;
    const userId = user?.sub || null;
    const username = user?.username || null;
    
    const success = this.mqttService.publish(publishDto.topic, publishDto.message, userId, username);
    return {
      success,
      message: success
        ? `Mensaje publicado en ${publishDto.topic}`
        : 'Error al publicar el mensaje',
    };
  }

  @Get('topics')
  getTopics() {
    const topics = this.mqttService.getSubscribedTopics();
    return ResponseUtil.success({ topics }, 'Topics suscritos obtenidos');
  }

  @Get('messages')
  async getMessages(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('topic') topic?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const options: any = {};
    
    if (limit) options.limit = parseInt(limit, 10);
    if (offset) options.offset = parseInt(offset, 10);
    if (topic) options.topic = topic;
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);

    const result = await this.mqttService.getMessages(options);
    return ResponseUtil.success(
      {
        messages: result.messages,
        total: result.total,
        limit: options.limit || 100,
        offset: options.offset || 0,
      },
      'Mensajes obtenidos exitosamente',
    );
  }

  @Get('messages/topics')
  async getUniqueTopics() {
    const topics = await this.mqttService.getUniqueTopics();
    return ResponseUtil.success({ topics }, 'Topics únicos obtenidos');
  }

  @Delete('messages/cleanup-procesado')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async limpiarTopicsProcesadoNoLuminarias() {
    try {
      const resultado = await this.mqttService.limpiarTopicsProcesadoNoLuminarias();
      return ResponseUtil.success(
        resultado,
        `Limpieza completada: ${resultado.eliminados} mensajes eliminados de ${resultado.topics.length} topics`,
      );
    } catch (error: any) {
      return ResponseUtil.error(
        `Error al limpiar topics procesado: ${error.message || 'Error desconocido'}`,
      );
    }
  }
}

