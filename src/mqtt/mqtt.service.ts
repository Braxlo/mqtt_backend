import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as mqtt from 'mqtt';
import { Subject } from 'rxjs';
import { MqttMessage as MqttMessageInterface, MqttConnectionStatus } from '../common/interfaces/mqtt-message.interface';
import { MqttMessage as MqttMessageEntity } from '../entities/mqtt-message.entity';
import { MqttSubscribedTopic } from '../entities/mqtt-subscribed-topic.entity';
import { MqttConfig } from '../entities/mqtt-config.entity';
import { Luminaria } from '../entities/luminaria.entity';
import { APP_CONSTANTS } from '../common/constants/app.constants';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private brokerUrl: string | null = null;
  private isConnected = false;
  private subscribedTopics = new Set<string>();
  public messageSubject = new Subject<MqttMessageInterface>();

  /**
   * Detecta si un mensaje contiene datos binarios (bytes no imprimibles)
   */
  private tieneDatosBinarios(buffer: Buffer): boolean {
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      // Detectar bytes no imprimibles (excepto espacios, tabs, newlines, carriage return)
      if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte > 126) {
        return true;
      }
    }
    return false;
  }

  /**
   * Encuentra el índice donde empiezan los datos binarios en el buffer
   */
  private encontrarInicioBinario(buffer: Buffer): number {
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      // Detectar bytes no imprimibles (excepto espacios, tabs, newlines, carriage return)
      if ((byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) || byte > 126) {
        return i;
      }
    }
    return -1; // No hay datos binarios
  }

  /**
   * Procesa un mensaje MQTT: separa texto de datos binarios
   * Si tiene datos binarios, guarda el texto normal y los binarios en Base64
   * Si no, lo devuelve como string normal
   */
  private procesarMensajeParaBD(message: Buffer): string {
    // Buscar dónde empiezan los datos binarios
    const indiceBinario = this.encontrarInicioBinario(message);
    
    if (indiceBinario === -1) {
      // No hay datos binarios, devolver como string normal
      return message.toString('utf8');
    }
    
    // Separar texto y datos binarios
    const parteTexto = message.slice(0, indiceBinario).toString('utf8');
    const parteBinaria = message.slice(indiceBinario);
    
    // Convertir solo la parte binaria a Base64
    const base64Binario = parteBinaria.toString('base64');
    
    // Guardar como: "texto __BINARY_BASE64__base64"
    return `${parteTexto}__BINARY_BASE64__${base64Binario}`;
  }

  /**
   * Convierte un mensaje guardado en BD de vuelta a su formato original
   * Si tiene __BINARY_BASE64__ en el mensaje, separa el texto y decodifica la parte binaria
   */
  private procesarMensajeDesdeBD(messageStr: string): string {
    const indicePrefijo = messageStr.indexOf('__BINARY_BASE64__');
    
    if (indicePrefijo === -1) {
      // No tiene datos binarios, devolver tal cual
      return messageStr;
    }
    
    // Separar texto y Base64
    const parteTexto = messageStr.substring(0, indicePrefijo);
    const base64 = messageStr.substring(indicePrefijo + '__BINARY_BASE64__'.length);
    
    try {
      // Decodificar Base64 a buffer y luego a string binario
      const buffer = Buffer.from(base64, 'base64');
      const parteBinaria = buffer.toString('binary');
      
      // Concatenar texto + datos binarios
      return parteTexto + parteBinaria;
    } catch (error) {
      this.logger.error(`Error al decodificar Base64: ${error.message}`);
      return messageStr;
    }
  }

  /**
   * Detecta si un mensaje es una trama HSE del regulador de carga (luminaria)
   */
  private esTramaHSE(buffer: Buffer): boolean {
    const messageStr = buffer.toString('utf8', 0, Math.min(20, buffer.length));
    const patronHSE = /^HSE\s+\d{6}\s+\d{4}\s+/i;
    return patronHSE.test(messageStr);
  }

  /**
   * Convierte un valor hexadecimal (2 bytes = 4 caracteres hex) a un número decimal
   * Aplica la fórmula: convertir 4 caracteres hex a decimal, luego dividir por 100
   */
  private convertirHexADecimal(hexAlto: string, hexBajo: string): number {
    try {
      const hexCompleto = hexAlto + hexBajo;
      const valorDecimal = parseInt(hexCompleto, 16);
      const valorFinal = valorDecimal / 100;
      return Math.round(valorFinal * 100) / 100; // Redondear a 2 decimales
    } catch (error) {
      this.logger.error("Error al convertir hexadecimal:", error);
      return 0;
    }
  }

  /**
   * Convierte un valor hexadecimal de 32 bits (4 bytes = 8 caracteres hex) a un número decimal
   * Los 32 bits están divididos en High (4 chars) y Low (4 chars)
   * Aplica la fórmula: (High * 65536 + Low) / 100
   */
  private convertirHex32BitsADecimal(hexHigh1: string, hexHigh2: string, hexLow1: string, hexLow2: string): number {
    try {
      const hexHigh = hexHigh1 + hexHigh2;
      const hexLow = hexLow1 + hexLow2;
      
      const valorHigh = parseInt(hexHigh, 16);
      const valorLow = parseInt(hexLow, 16);
      
      const valor32Bits = valorHigh * 65536 + valorLow;
      const valorFinal = valor32Bits / 100;
      return Math.round(valorFinal * 100) / 100; // Redondear a 2 decimales
    } catch (error) {
      this.logger.error("Error al convertir hexadecimal de 32 bits:", error);
      return 0;
    }
  }

  /**
   * Verifica si un topic es de una luminaria (consultando la categoría en la base de datos)
   */
  private async esTopicLuminaria(topic: string): Promise<boolean> {
    try {
      // Primero verificar la categoría en mqtt_subscribed_topics
      const subscribedTopic = await this.mqttSubscribedTopicRepository.findOne({
        where: { topic },
      });
      
      if (subscribedTopic) {
        this.logger.debug(`Topic ${topic} encontrado en mqtt_subscribed_topics. Categoría: ${subscribedTopic.categoria || 'null'}`);
        if (subscribedTopic.categoria === 'luminarias') {
          this.logger.debug(`Topic ${topic} es de categoría 'luminarias'`);
          return true;
        }
      } else {
        this.logger.debug(`Topic ${topic} NO encontrado en mqtt_subscribed_topics`);
      }
      
      // También verificar si está en la tabla de luminarias (para compatibilidad)
      const luminaria = await this.luminariaRepository.findOne({
        where: { topic },
      });
      
      if (luminaria) {
        this.logger.debug(`Topic ${topic} encontrado en tabla luminarias`);
        return true;
      } else {
        this.logger.debug(`Topic ${topic} NO encontrado en tabla luminarias`);
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error al verificar si topic es luminaria: ${error.message}`);
      return false;
    }
  }

  /**
   * Verifica si un topic es una luminaria que requiere orden Little-Endian (16, 17, 18, 19)
   */
  private esLuminariaLittleEndian(topic: string): boolean {
    // Verificar si el topic termina en 16, 17, 18 o 19
    const match = topic.match(/(?:LM|LUMINARIA)(?:0?)?([1][6-9])$/i);
    return match !== null && ['16', '17', '18', '19'].includes(match[1]);
  }

  /**
   * Parsea una trama HSE del regulador de carga y retorna los valores convertidos
   * Formato: "HSE 260114 2353 " seguido de bytes binarios
   * Orden: VS, CS, SW (32 bits), VB, CB, LV, LC, LP (32 bits)
   * IMPORTANTE: Para LM016, LM017, LM018, LM019 los bytes 32-bit vienen en Little-Endian (Low primero, High después)
   */
  private parsearTramaHSE(buffer: Buffer, topic?: string): any | null {
    try {
      const messageStr = buffer.toString('binary');
      const cleaned = messageStr.trim();

      if (!cleaned.toUpperCase().startsWith("HSE")) {
        return null;
      }

      // Buscar el patrón HSE + fecha + hora + espacio
      const patronHSE = /^HSE\s+(\d{6})\s+(\d{4})\s+/i;
      const match = cleaned.match(patronHSE);
      
      if (!match) {
        return null;
      }

      const fechaStr = match[1];
      const horaStr = match[2];
      const inicioDatos = match[0].length;

      // Formatear fecha (DDMMYY)
      const fecha = fechaStr.length === 6
        ? `${fechaStr.substring(0, 2)}/${fechaStr.substring(2, 4)}/${fechaStr.substring(4, 6)}`
        : fechaStr;

      // Formatear hora (HHMM)
      const hora = horaStr.length === 4
        ? `${horaStr.substring(0, 2)}:${horaStr.substring(2, 4)}`
        : horaStr;

      // Extraer bytes binarios desde el inicio de los datos
      const bytes: number[] = [];
      for (let i = inicioDatos; i < buffer.length; i++) {
        bytes.push(buffer[i]);
      }

      if (bytes.length < 20) {
        this.logger.warn(`Trama HSE incompleta: solo ${bytes.length} bytes`);
        return null;
      }

      const hexValues = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase());

      const datos: any = {
        fecha,
        hora,
        timestamp: new Date().toISOString(),
      };

      // Byte 0-1: VS [V] - Voltaje Solar
      if (hexValues.length >= 2) {
        datos.voltajeSolar = this.convertirHexADecimal(hexValues[0], hexValues[1]);
      }

      // Byte 2-3: CS [A] - Corriente Solar
      if (hexValues.length >= 4) {
        datos.corrienteSolar = this.convertirHexADecimal(hexValues[2], hexValues[3]);
      }

      // Byte 4-7: SW [W] - Potencia Solar (32 bits)
      // IMPORTANTE: Para LM016-019, los bytes vienen en Little-Endian (Low primero, High después)
      // En el mensaje: byte 4-5 = Low, byte 6-7 = High
      // La función espera: High primero, Low después
      const esLittleEndian = topic ? this.esLuminariaLittleEndian(topic) : false;
      if (hexValues.length >= 8) {
        if (esLittleEndian) {
          // Orden Little-Endian: Low primero, High después en el mensaje
          datos.potenciaSolar = this.convertirHex32BitsADecimal(
            hexValues[6], hexValues[7],  // High (bytes 6-7 del mensaje)
            hexValues[4], hexValues[5]   // Low (bytes 4-5 del mensaje)
          );
        } else {
          // Orden Big-Endian estándar: High primero, Low después en el mensaje
          datos.potenciaSolar = this.convertirHex32BitsADecimal(
            hexValues[4], hexValues[5],  // High
            hexValues[6], hexValues[7]   // Low
          );
        }
      }

      // Byte 8-9: VB [V] - Voltaje Batería
      if (hexValues.length >= 10) {
        datos.voltajeBateria = this.convertirHexADecimal(hexValues[8], hexValues[9]);
      }

      // Byte 10-11: CB [A] - Corriente Batería
      if (hexValues.length >= 12) {
        datos.corrienteBateria = this.convertirHexADecimal(hexValues[10], hexValues[11]);
      }

      // Byte 12-13: LV [V] - Voltaje Cargas
      if (hexValues.length >= 14) {
        datos.voltajeCargas = this.convertirHexADecimal(hexValues[12], hexValues[13]);
      }

      // Byte 14-15: LC [A] - Corriente Cargas
      if (hexValues.length >= 16) {
        datos.corrienteCargas = this.convertirHexADecimal(hexValues[14], hexValues[15]);
      }

      // Byte 16-19: LP [W] - Potencia Cargas / Luminosidad (32 bits)
      // IMPORTANTE: Para LM016-019, los bytes vienen en Little-Endian (Low primero, High después)
      // En el mensaje: byte 16-17 = Low, byte 18-19 = High
      // La función espera: High primero, Low después
      // Ejemplo: 2D 8B 00 01 → Low=2D8B (11659), High=0001 (1) → (1*65536 + 11659)/100 = 771.95
      if (hexValues.length >= 20) {
        if (esLittleEndian) {
          // Orden Little-Endian: Low primero, High después en el mensaje
          datos.potenciaCargas = this.convertirHex32BitsADecimal(
            hexValues[18], hexValues[19],  // High (bytes 18-19 del mensaje)
            hexValues[16], hexValues[17]   // Low (bytes 16-17 del mensaje)
          );
        } else {
          // Orden Big-Endian estándar: High primero, Low después en el mensaje
          datos.potenciaCargas = this.convertirHex32BitsADecimal(
            hexValues[16], hexValues[17],  // High
            hexValues[18], hexValues[19]  // Low
          );
        }
      }

      return datos;
    } catch (error) {
      this.logger.error(`Error al parsear trama HSE: ${error.message}`);
      return null;
    }
  }

  constructor(
    @InjectRepository(MqttMessageEntity)
    private mqttMessageRepository: Repository<MqttMessageEntity>,
    @InjectRepository(MqttSubscribedTopic)
    private mqttSubscribedTopicRepository: Repository<MqttSubscribedTopic>,
    @InjectRepository(MqttConfig)
    private mqttConfigRepository: Repository<MqttConfig>,
    @InjectRepository(Luminaria)
    private luminariaRepository: Repository<Luminaria>,
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
        // Procesar mensaje: convertir a string para comparación y detección de duplicados
        const messageStr = message.toString('utf8');
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
        
        // Procesar mensaje para guardar en BD (convierte binarios a Base64)
        const messageParaBD = this.procesarMensajeParaBD(message);
        
        // Para enviar al frontend, también usar Base64 si tiene datos binarios
        // JSON no puede manejar bytes nulos, así que usamos Base64
        const messageParaFrontend = this.procesarMensajeParaBD(message);
        
        const mqttMessage: MqttMessageInterface = {
          topic,
          message: messageParaFrontend, // Ya procesado (Base64 si es binario, string normal si no)
          timestamp,
          userId: null,
          username: null,
        };
        this.logger.debug(`Mensaje recibido en ${topic}: ${messageStr.substring(0, 100)}${messageStr.length > 100 ? '...' : ''}`);
        
        // Guardar mensaje original en la base de datos (con datos binarios convertidos a Base64 si es necesario)
        try {
          const messageEntity = this.mqttMessageRepository.create({
            topic,
            message: messageParaBD,
            timestamp,
            userId: null,
            username: null,
          });
          await this.mqttMessageRepository.save(messageEntity);
        } catch (error) {
          this.logger.error(`Error al guardar mensaje MQTT en BD: ${error.message}`);
        }
        
        // Detectar si es una trama HSE de luminaria y procesar
        // IMPORTANTE: Solo procesar si el topic es de una luminaria (no barreras u otros)
        if (this.esTramaHSE(message)) {
          // Verificar si el topic es de una luminaria consultando la base de datos
          const esLuminaria = await this.esTopicLuminaria(topic);
          
          if (esLuminaria) {
            const datosConvertidos = this.parsearTramaHSE(message, topic);
            
            if (datosConvertidos) {
              // Crear tópico procesado: agregar "/procesado" al tópico original
              const topicProcesado = `${topic}/procesado`;
              
              // Crear mensaje JSON con los valores convertidos
              const mensajeProcesado = JSON.stringify(datosConvertidos);
              
              // Publicar en el tópico procesado (sin guardar en BD para evitar duplicados)
              // Solo publicar si el cliente está conectado
              if (this.client && this.isConnected) {
                try {
                  this.client.publish(topicProcesado, mensajeProcesado, { qos: 0 }, (err) => {
                    if (err) {
                      this.logger.error(`Error al publicar mensaje procesado en ${topicProcesado}: ${err.message}`);
                    } else {
                      this.logger.debug(`Mensaje procesado publicado en ${topicProcesado}`);
                    }
                  });
                  
                  // Guardar mensaje procesado en BD
                  try {
                    const messageEntityProcesado = this.mqttMessageRepository.create({
                      topic: topicProcesado,
                      message: mensajeProcesado,
                      timestamp,
                      userId: null,
                      username: null,
                    });
                    await this.mqttMessageRepository.save(messageEntityProcesado);
                    this.logger.debug(`Mensaje procesado guardado en BD: ${topicProcesado}`);
                  } catch (error) {
                    this.logger.error(`Error al guardar mensaje procesado en BD: ${error.message}`);
                  }
                } catch (error) {
                  this.logger.error(`Error al procesar trama HSE: ${error.message}`);
                }
              }
            }
          } else {
            // Es una trama HSE pero no es de luminaria, solo guardar el mensaje original (ya guardado arriba)
            this.logger.warn(`⚠️ Trama HSE detectada en ${topic} pero no se procesará porque no tiene categoría 'luminarias'.`);
            this.logger.warn(`   Para procesar este topic, actualiza su categoría a 'luminarias' en la página de Configuración (Settings).`);
          }
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

  async subscribe(topic: string, categoria?: 'chancado' | 'luminarias' | 'barreras' | 'otras_barreras' | 'otros' | 'prueba'): Promise<boolean> {
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
            this.logger.log(`Suscrito al topic: ${topic}${categoria ? ` (categoría: ${categoria})` : ''}`);
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
                }
                // Actualizar categoría si se proporciona
                if (categoria) {
                  existingTopic.categoria = categoria;
                }
                await this.mqttSubscribedTopicRepository.save(existingTopic);
              } else {
                // Crear nuevo registro
                const topicEntity = this.mqttSubscribedTopicRepository.create({
                  topic,
                  active: true,
                  categoria: categoria || 'otros',
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

  async updateTopicCategory(topic: string, categoria: 'chancado' | 'luminarias' | 'barreras' | 'otras_barreras' | 'otros' | 'prueba'): Promise<boolean> {
    try {
      const topicEntity = await this.mqttSubscribedTopicRepository.findOne({
        where: { topic },
      });
      
      if (topicEntity) {
        topicEntity.categoria = categoria;
        await this.mqttSubscribedTopicRepository.save(topicEntity);
        this.logger.log(`Categoría actualizada para ${topic}: ${categoria}`);
        return true;
      }
      
      this.logger.warn(`Topic ${topic} no encontrado para actualizar categoría`);
      return false;
    } catch (error) {
      this.logger.error(`Error al actualizar categoría del topic: ${error.message}`);
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

      // Procesar mensajes: convertir Base64 de vuelta a formato original
      const processedMessages = messages.map((msg) => ({
        ...msg,
        message: this.procesarMensajeDesdeBD(msg.message),
      }));

      return { messages: processedMessages, total };
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

