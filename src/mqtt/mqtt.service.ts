import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mqtt from 'mqtt';
import { Subject } from 'rxjs';
import { MqttMessage as MqttMessageInterface, MqttConnectionStatus } from '../common/interfaces/mqtt-message.interface';
import { MqttMessage as MqttMessageEntity } from '../entities/mqtt-message.entity';
import { MqttSubscribedTopic } from '../entities/mqtt-subscribed-topic.entity';
import { MqttConfig } from '../entities/mqtt-config.entity';
import { APP_CONSTANTS } from '../common/constants/app.constants';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private brokerUrl: string | null = null;
  private isConnected = false;
  private subscribedTopics = new Set<string>();
  public messageSubject = new Subject<MqttMessageInterface>();

  constructor(
    @InjectRepository(MqttMessageEntity)
    private mqttMessageRepository: Repository<MqttMessageEntity>,
    @InjectRepository(MqttSubscribedTopic)
    private mqttSubscribedTopicRepository: Repository<MqttSubscribedTopic>,
    @InjectRepository(MqttConfig)
    private mqttConfigRepository: Repository<MqttConfig>,
  ) {}

  async onModuleInit() {
    this.logger.log('MqttService inicializado');
    // Intentar conectar automáticamente si hay configuración guardada
    await this.autoConnect();
  }

  /**
   * Conectar automáticamente al broker si hay configuración guardada
   */
  private async autoConnect(): Promise<void> {
    try {
      let config = await this.mqttConfigRepository.findOne({
        where: { id: 'default' },
      });

      // Si no existe configuración, crear una por defecto
      if (!config) {
        config = this.mqttConfigRepository.create({
          id: 'default',
          brokerUrl: null,
          autoConnect: false,
        });
        await this.mqttConfigRepository.save(config);
        this.logger.log('Configuración MQTT inicializada');
        return;
      }

      // Si hay broker URL y autoConnect está activado, conectar
      if (config.brokerUrl && config.autoConnect) {
        this.logger.log(`Auto-conectando al broker MQTT: ${config.brokerUrl}`);
        await this.connect(config.brokerUrl);
      }
    } catch (error) {
      this.logger.error(`Error en auto-conexión MQTT: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    // Limpiar conexión al destruir el módulo
    await this.disconnect();
    this.messageSubject.complete();
  }

  async connect(brokerUrl: string, autoConnect: boolean = true): Promise<boolean> {
    try {
      if (this.client && this.isConnected) {
        await this.disconnect();
      }

      this.brokerUrl = brokerUrl;
      this.logger.log(`Conectando al broker MQTT: ${brokerUrl}`);

      // Guardar configuración en la base de datos
      try {
        let config = await this.mqttConfigRepository.findOne({
          where: { id: 'default' },
        });

        if (!config) {
          config = this.mqttConfigRepository.create({
            id: 'default',
            brokerUrl,
            autoConnect,
          });
        } else {
          config.brokerUrl = brokerUrl;
          config.autoConnect = autoConnect;
        }

        await this.mqttConfigRepository.save(config);
        this.logger.log('Configuración MQTT guardada en la base de datos');
      } catch (dbError) {
        this.logger.error(`Error al guardar configuración MQTT: ${dbError.message}`);
      }

      this.client = mqtt.connect(brokerUrl, {
        clientId: `centinela-backend-${Date.now()}`,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      });

      this.client.on('connect', async () => {
        this.isConnected = true;
        this.logger.log('Conectado al broker MQTT exitosamente');
        // Cargar topics suscritos desde la base de datos y resuscribir
        await this.loadSubscribedTopicsFromDB();
        // Emitir evento de conexión (se manejará en el gateway)
      });

      this.client.on('message', async (topic, message) => {
        const messageStr = message.toString();
        const timestamp = new Date();
        
        // Verificar si este mensaje fue publicado por un usuario (para evitar duplicados)
        const messageKey = `${topic}|${messageStr}|${Math.floor(timestamp.getTime() / 5000) * 5000}`;
        const publishedMessages = (this as any).publishedMessages || new Set();
        
        // Si el mensaje fue publicado por un usuario, ya se emitió con la información del usuario
        // Solo procesar mensajes que vienen del broker (sin usuario)
        const isPublishedByUser = Array.from(publishedMessages).some((key: string) => 
          key.startsWith(`${topic}|${messageStr}|`)
        );
        
        if (isPublishedByUser) {
          this.logger.debug(`Mensaje ${topic} ya fue procesado (publicado por usuario), omitiendo duplicado`);
          return;
        }
        
        const mqttMessage: MqttMessageInterface = {
          topic,
          message: messageStr,
          timestamp,
          userId: null,
          username: null,
        };
        this.logger.debug(`Mensaje recibido en ${topic}: ${messageStr}`);
        
        // Guardar mensaje en la base de datos
        try {
          const messageEntity = this.mqttMessageRepository.create({
            topic,
            message: messageStr,
            timestamp,
            userId: null,
            username: null,
          });
          await this.mqttMessageRepository.save(messageEntity);
        } catch (error) {
          this.logger.error(`Error al guardar mensaje MQTT en BD: ${error.message}`);
        }
        
        // Emitir mensaje a través del Subject
        this.messageSubject.next(mqttMessage);
      });

      this.client.on('error', (error) => {
        this.logger.error(`Error MQTT: ${error.message}`);
        this.isConnected = false;
      });

      this.client.on('close', async () => {
        this.logger.warn('Conexión MQTT cerrada');
        this.isConnected = false;
        // Emitir evento de desconexión (se manejará en el gateway)
      });

      this.client.on('reconnect', () => {
        this.logger.log('Reconectando al broker MQTT...');
      });

      return new Promise((resolve) => {
        this.client!.on('connect', () => {
          resolve(true);
        });
        this.client!.on('error', () => {
          resolve(false);
        });
      });
    } catch (error) {
      this.logger.error(`Error al conectar: ${error.message}`);
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.isConnected = false;
      // No limpiar los topics de la BD, solo de memoria
      this.subscribedTopics.clear();
      this.logger.log('Desconectado del broker MQTT');

      // Actualizar configuración para desactivar autoConnect
      try {
        const config = await this.mqttConfigRepository.findOne({
          where: { id: 'default' },
        });
        if (config) {
          config.autoConnect = false;
          await this.mqttConfigRepository.save(config);
        }
      } catch (dbError) {
        this.logger.error(`Error al actualizar configuración MQTT: ${dbError.message}`);
      }
    }
  }

  /**
   * Cargar topics suscritos desde la base de datos
   */
  private async loadSubscribedTopicsFromDB(): Promise<void> {
    try {
      const topics = await this.mqttSubscribedTopicRepository.find({
        where: { active: true },
      });
      
      this.logger.log(`Cargando ${topics.length} topics suscritos desde la BD`);
      
      for (const topicEntity of topics) {
        this.subscribedTopics.add(topicEntity.topic);
        // Suscribir al topic en el cliente MQTT
        if (this.client && this.isConnected) {
          this.client.subscribe(topicEntity.topic, (err) => {
            if (err) {
              this.logger.error(`Error al resuscribirse a ${topicEntity.topic}: ${err.message}`);
            } else {
              this.logger.log(`Resuscrito al topic: ${topicEntity.topic}`);
            }
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error al cargar topics suscritos desde BD: ${error.message}`);
    }
  }

  async subscribe(topic: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      this.logger.warn('No hay conexión MQTT activa');
      return false;
    }

    try {
      return new Promise((resolve) => {
        this.client!.subscribe(topic, async (err) => {
          if (err) {
            this.logger.error(`Error al suscribirse a ${topic}: ${err.message}`);
            resolve(false);
          } else {
            this.logger.log(`Suscrito al topic: ${topic}`);
            this.subscribedTopics.add(topic);
            
            // Guardar en la base de datos
            try {
              const existingTopic = await this.mqttSubscribedTopicRepository.findOne({
                where: { topic },
              });
              
              if (existingTopic) {
                // Si existe pero está inactivo, reactivarlo
                if (!existingTopic.active) {
                  existingTopic.active = true;
                  await this.mqttSubscribedTopicRepository.save(existingTopic);
                }
              } else {
                // Crear nuevo registro
                const topicEntity = this.mqttSubscribedTopicRepository.create({
                  topic,
                  active: true,
                });
                await this.mqttSubscribedTopicRepository.save(topicEntity);
              }
            } catch (dbError) {
              this.logger.error(`Error al guardar topic en BD: ${dbError.message}`);
            }
            
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.error(`Error al suscribirse: ${error.message}`);
      return false;
    }
  }

  async unsubscribe(topic: string): Promise<boolean> {
    if (!this.client || !this.isConnected) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        this.client!.unsubscribe(topic, async (err) => {
          if (err) {
            this.logger.error(`Error al desuscribirse de ${topic}: ${err.message}`);
            resolve(false);
          } else {
            this.logger.log(`Desuscrito del topic: ${topic}`);
            this.subscribedTopics.delete(topic);
            
            // Marcar como inactivo en la base de datos (no eliminar para mantener historial)
            try {
              const topicEntity = await this.mqttSubscribedTopicRepository.findOne({
                where: { topic },
              });
              
              if (topicEntity) {
                topicEntity.active = false;
                await this.mqttSubscribedTopicRepository.save(topicEntity);
              }
            } catch (dbError) {
              this.logger.error(`Error al actualizar topic en BD: ${dbError.message}`);
            }
            
            resolve(true);
          }
        });
      });
    } catch (error) {
      this.logger.error(`Error al desuscribirse: ${error.message}`);
      return false;
    }
  }

  publish(topic: string, message: string, userId?: number | null, username?: string | null): boolean {
    if (!this.client || !this.isConnected) {
      this.logger.warn('No hay conexión MQTT activa');
      return false;
    }

    try {
      const timestamp = new Date();
      
      // Guardar mensaje en la base de datos con información del usuario
      const messageEntity = this.mqttMessageRepository.create({
        topic,
        message,
        timestamp,
        userId: userId || null,
        username: username || null,
      });
      
      // Marcar este mensaje como publicado por un usuario para evitar duplicarlo cuando el broker lo reenvía
      const publishedMessageKey = `${topic}|${message}|${timestamp.getTime()}`;
      const publishedMessages = (this as any).publishedMessages || new Set();
      publishedMessages.add(publishedMessageKey);
      (this as any).publishedMessages = publishedMessages;
      
      // Limpiar la clave después de 5 segundos (tiempo suficiente para que el broker lo reenvíe)
      setTimeout(() => {
        publishedMessages.delete(publishedMessageKey);
      }, 5000);
      
      this.mqttMessageRepository.save(messageEntity)
        .then((savedMessage) => {
          this.logger.log(`Mensaje guardado en BD: ${topic} por usuario ${username || 'desconocido'}`);
          
          // Emitir mensaje directamente al WebSocket con información del usuario
          // Esto evita que el mensaje se duplique cuando el broker lo reenvía
          const mqttMessage: MqttMessageInterface = {
            topic,
            message,
            timestamp,
            userId: savedMessage.userId || null,
            username: savedMessage.username || null,
          };
          this.messageSubject.next(mqttMessage);
        })
        .catch((error) => {
          this.logger.error(`Error al guardar mensaje publicado en BD: ${error.message}`);
        });

      this.client.publish(topic, message, (err) => {
        if (err) {
          this.logger.error(`Error al publicar en ${topic}: ${err.message}`);
        } else {
          this.logger.log(`Mensaje publicado en ${topic}: ${message} por usuario ${username || 'desconocido'}`);
        }
      });
      return true;
    } catch (error) {
      this.logger.error(`Error al publicar: ${error.message}`);
      return false;
    }
  }

  getConnectionStatus(): MqttConnectionStatus {
    return {
      connected: this.isConnected,
      brokerUrl: this.brokerUrl,
      subscribedTopics: this.getSubscribedTopics(),
    };
  }

  getSubscribedTopics(): string[] {
    return Array.from(this.subscribedTopics);
  }

  /**
   * Obtener mensajes históricos de la base de datos
   */
  async getMessages(options?: {
    limit?: number;
    offset?: number;
    topic?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<{ messages: MqttMessageEntity[]; total: number }> {
    try {
      const limit = options?.limit || 100;
      const offset = options?.offset || 0;

      const queryBuilder = this.mqttMessageRepository.createQueryBuilder('message');

      // Filtrar por topic si se proporciona
      if (options?.topic) {
        queryBuilder.where('message.topic = :topic', { topic: options.topic });
      }

      // Filtrar por rango de fechas si se proporciona
      if (options?.startDate) {
        queryBuilder.andWhere('message.timestamp >= :startDate', {
          startDate: options.startDate,
        });
      }
      if (options?.endDate) {
        queryBuilder.andWhere('message.timestamp <= :endDate', {
          endDate: options.endDate,
        });
      }

      // Ordenar por fecha descendente (más recientes primero)
      queryBuilder.orderBy('message.timestamp', 'DESC');

      // Aplicar paginación
      queryBuilder.skip(offset).take(limit);

      const [messages, total] = await queryBuilder.getManyAndCount();

      return { messages, total };
    } catch (error) {
      this.logger.error(`Error al obtener mensajes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Obtener lista de topics únicos de los mensajes guardados
   */
  async getUniqueTopics(): Promise<string[]> {
    try {
      const result = await this.mqttMessageRepository
        .createQueryBuilder('message')
        .select('DISTINCT message.topic', 'topic')
        .orderBy('message.topic', 'ASC')
        .getRawMany();

      return result.map((row) => row.topic);
    } catch (error) {
      this.logger.error(`Error al obtener topics únicos: ${error.message}`);
      return [];
    }
  }
}

