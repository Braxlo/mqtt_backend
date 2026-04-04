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
import { Letrero } from '../entities/letrero.entity';
import { Barrera } from '../entities/barrera.entity';
import { APP_CONSTANTS } from '../common/constants/app.constants';
import {
  enumerarEtiquetasYmdInclusive,
  formatoVentanaOperativaCorta,
  formatFechaHoraChile,
  getDiaOperacionalKeyChile,
  getHourChile,
  rangoOperacionalQueryUtc,
  registroEnVentanaOperacionalEtiqueta,
} from '../common/chile-datetime';
import * as ExcelJS from 'exceljs';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private brokerUrl: string | null = null;
  private username: string | null = null;
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
   * Detecta si un mensaje es una trama HSE/HSP del regulador de carga (energía).
   * Acepta formato con bytes binarios o con bytes en texto (hex separado por espacios, ej. "HSE 260219 1816 ! 0B 02 1E B3 ...").
   */
  private esTramaHSE(buffer: Buffer): boolean {
    const messageStr = buffer.toString('utf8', 0, Math.min(50, buffer.length));
    const patron = /^HS[EP]\s+\d{6}\s+\d{4}\s+/i;
    return patron.test(messageStr);
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
   * Convierte un valor hexadecimal de 32 bits (4 bytes) a un número decimal
   * High y Low son palabras de 16 bits. Fórmula: (High * 65536 + Low) / 100
   * Ejemplo: High=0x0001, Low=0x2D8B → 77195 / 100 = 771.95
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
   * Convierte un DWORD (4 bytes hex) a float IEEE 754 (Real).
   * Usado por tramas HSE con 32 bytes (8× DWORD) o tipo DWORD.
   */
  private convertirDwordAIEEE754Float(
    hexHigh1: string, hexHigh2: string, hexLow1: string, hexLow2: string,
    littleEndian: boolean = false
  ): number {
    try {
      const valorHigh = parseInt(hexHigh1 + hexHigh2, 16);
      const valorLow = parseInt(hexLow1 + hexLow2, 16);
      const dword = (valorHigh << 16) | valorLow;

      const buffer = Buffer.alloc(4);
      if (littleEndian) {
        buffer.writeUInt32LE(dword, 0);
        return Math.round(buffer.readFloatLE(0) * 100) / 100;
      }
      buffer.writeUInt32BE(dword, 0);
      return Math.round(buffer.readFloatBE(0) * 100) / 100;
    } catch (error) {
      this.logger.error('Error al convertir DWORD a IEEE 754 float:', error);
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
      }
      
      return false;
    } catch (error) {
      this.logger.error(`Error al verificar si topic es luminaria: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene el tipo de dispositivo de una luminaria por su topic
   * @param topic Topic MQTT de la luminaria
   * @returns Tipo de dispositivo: 'RPI', 'PLC_S', 'PLC_N' o null si no se encuentra
   */
  private async obtenerTipoDispositivoLuminaria(topic: string): Promise<'RPI' | 'PLC_S' | 'PLC_N' | null> {
    try {
      const luminaria = await this.luminariaRepository.findOne({
        where: { topic },
      });

      if (luminaria) {
        const tipo = luminaria.tipoDispositivo as 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD' | null | undefined;

        if (tipo === 'DWORD' || !tipo) {
          // Default a PLC_S para compatibilidad
          return 'PLC_S';
        }

        return tipo;
      }

      return null;
    } catch (error) {
      this.logger.error(`Error al obtener tipo de dispositivo para topic ${topic}: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica si un topic es de un letrero (consultando la categoría en la base de datos o tabla letreros).
   * Se normaliza el topic (trim) para que coincida con la configuración del letrero.
   */
  private async esTopicLetrero(topic: string): Promise<boolean> {
    try {
      const topicNorm = (topic || '').trim();
      const topicNormLower = topicNorm.toLowerCase();
      const subscribedTopic = await this.mqttSubscribedTopicRepository.findOne({
        where: { topic: topicNorm },
      });
      if (subscribedTopic?.categoria === 'letreros') {
        return true;
      }
      let letrero = await this.letreroRepository.findOne({ where: { topic: topicNorm } });
      if (!letrero) {
        const todos = await this.letreroRepository.find();
        letrero = todos.find((l) => (l.topic || '').trim().toLowerCase() === topicNormLower) ?? null;
      }
      return !!letrero;
    } catch (error) {
      this.logger.error(`Error al verificar si topic es letrero: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene el tipo de dispositivo de un letrero por su topic.
   * Si está configurado como PLC_S (Requiere procesamiento), se usa la misma lógica que para luminarias.
   */
  private async obtenerTipoDispositivoLetrero(topic: string): Promise<'RPI' | 'PLC_S' | 'PLC_N' | null> {
    try {
      const topicNorm = (topic || '').trim().toLowerCase();
      let letrero = await this.letreroRepository.findOne({
        where: { topic: (topic || '').trim() },
      });
      if (!letrero) {
        const todos = await this.letreroRepository.find();
        letrero = todos.find((l) => (l.topic || '').trim().toLowerCase() === topicNorm) ?? null;
      }
      if (letrero) {
        const tipo = letrero.tipoDispositivo as 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD' | null | undefined;

        if (tipo === 'DWORD' || !tipo) {
          return 'PLC_S';
        }

        return tipo;
      }
      return null;
    } catch (error) {
      this.logger.error(`Error al obtener tipo de dispositivo letrero para topic ${topic}: ${error.message}`);
      return null;
    }
  }

  /**
   * Verifica si un topic es de una barrera configurada (topic base, sin /procesado).
   */
  private async esTopicBarrera(topic: string): Promise<boolean> {
    try {
      const topicBase = (topic || '').replace(/\/procesado$/i, '').trim();
      const topicNorm = topicBase.toLowerCase();
      const barrera = await this.barreraRepository.findOne({
        where: { topic: topicBase },
      });
      if (barrera) return true;
      const todas = await this.barreraRepository.find();
      return todas.some((b) => (b.topic || '').trim().toLowerCase() === topicNorm);
    } catch (error) {
      this.logger.error(`Error al verificar si topic es barrera: ${error.message}`);
      return false;
    }
  }

  /**
   * Obtiene el tipo de dispositivo de una barrera por su topic (base, sin /procesado).
   */
  private async obtenerTipoDispositivoBarrera(topic: string): Promise<'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD' | null> {
    try {
      const topicBase = (topic || '').replace(/\/procesado$/i, '').trim();
      const topicNorm = topicBase.toLowerCase();
      let barrera = await this.barreraRepository.findOne({
        where: { topic: topicBase },
      });
      if (!barrera) {
        const todas = await this.barreraRepository.find();
        barrera = todas.find((b) => (b.topic || '').trim().toLowerCase() === topicNorm) ?? null;
      }
      if (barrera) {
        const tipo = barrera.tipoDispositivo as 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD' | undefined;
        return tipo ?? 'PLC_S';
      }
      return null;
    } catch (error) {
      this.logger.error(`Error al obtener tipo de dispositivo barrera para topic ${topic}: ${error.message}`);
      return null;
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
   * Parsea una trama HSE/HSP del regulador de carga y retorna los valores convertidos
   * - HSE/HSP con 32 bytes: 8× DWORD IEEE 754 (VS, CS, SW, VB, CB, LV, LC, LP) — p. ej. VMS02
   * - HSE/HSP con 20 bytes: formato clásico (VS,CS 2B; SW 4B; VB,CB,LV,LC 2B; LP 4B). Si tipoDispositivo es DWORD, SW y LP se interpretan como IEEE 754.
   */
  private parsearTramaHSE(buffer: Buffer, topic?: string, esLetrero?: boolean, tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD'): any | null {
    try {
      const messageStr = buffer.toString('binary');
      const cleaned = messageStr.trim();

      const upper = cleaned.toUpperCase();
      if (!(upper.startsWith("HSE") || upper.startsWith("HSP"))) {
        return null;
      }

      // Buscar el patrón HSE/HSP + fecha + hora + espacio
      const patron = /^HS[EP]\s+(\d{6})\s+(\d{4})\s+/i;
      const match = cleaned.match(patron);
      
      if (!match) {
        return null;
      }

      const fechaStr = match[1];
      const horaStr = match[2];
      const inicioDatos = match[0].length;

      // Formatear fecha - detectar automáticamente si es DDMMYY o YYMMDD
      let fecha: string;
      if (fechaStr.length === 6) {
        // Intentar primero como DDMMYY
        const dd1 = fechaStr.substring(0, 2);
        const mm1 = fechaStr.substring(2, 4);
        const yy1 = fechaStr.substring(4, 6);
        const mes1 = parseInt(mm1);
        const dia1 = parseInt(dd1);
        
        // Intentar como YYMMDD
        const yy2 = fechaStr.substring(0, 2);
        const mm2 = fechaStr.substring(2, 4);
        const dd2 = fechaStr.substring(4, 6);
        const mes2 = parseInt(mm2);
        const dia2 = parseInt(dd2);
        
        // Validar ambas: mes debe estar entre 1-12, día entre 1-31
        const valida1 = mes1 >= 1 && mes1 <= 12 && dia1 >= 1 && dia1 <= 31;
        const valida2 = mes2 >= 1 && mes2 <= 12 && dia2 >= 1 && dia2 <= 31;
        
        if (valida1 && valida2) {
          // Ambas válidas: usar DDMMYY por defecto (formato más común)
          fecha = `${dd1}/${mm1}/${yy1}`;
        } else if (valida1) {
          fecha = `${dd1}/${mm1}/${yy1}`;
        } else if (valida2) {
          // Es YYMMDD, convertir a DDMMYY para visualización
          fecha = `${dd2}/${mm2}/${yy2}`;
        } else {
          // Ninguna válida, usar formato original
          fecha = fechaStr;
        }
      } else {
        fecha = fechaStr;
      }

      // Formatear hora (HHMM)
      const hora = horaStr.length === 4
        ? `${horaStr.substring(0, 2)}:${horaStr.substring(2, 4)}`
        : horaStr;

      // Extraer bytes: soportar binario o texto hex; aceptar 20 o 32 bytes
      const restoStr = buffer.toString('utf8', inicioDatos, buffer.length).trim();
      const hexPairsFromText = restoStr.match(/\b[0-9A-Fa-f]{2}\b/g);
      let bytes: number[];
      if (hexPairsFromText && hexPairsFromText.length >= 20) {
        bytes = hexPairsFromText.map((hex) => parseInt(hex, 16));
        this.logger.debug(`Trama HSE con bytes en texto (hex): ${bytes.length} bytes parseados`);
      } else {
        bytes = [];
        for (let i = inicioDatos; i < buffer.length; i++) {
          bytes.push(buffer[i]);
        }
      }

      if (bytes.length < 20) {
        this.logger.warn(`Trama HSE incompleta: solo ${bytes.length} bytes (mínimo 20)`);
        return null;
      }

      const hexValues = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase());
      const datos: any = { fecha, hora, timestamp: new Date().toISOString() };

      // HSE con 32 bytes = 8× DWORD IEEE 754 (Real), mismo layout que HSP — p. ej. VMS02
      if (hexValues.length >= 32) {
        datos.voltajeSolar = this.convertirDwordAIEEE754Float(hexValues[0], hexValues[1], hexValues[2], hexValues[3], false);
        datos.corrienteSolar = this.convertirDwordAIEEE754Float(hexValues[4], hexValues[5], hexValues[6], hexValues[7], false);
        datos.potenciaSolar = this.convertirDwordAIEEE754Float(hexValues[8], hexValues[9], hexValues[10], hexValues[11], false);
        datos.voltajeBateria = this.convertirDwordAIEEE754Float(hexValues[12], hexValues[13], hexValues[14], hexValues[15], false);
        datos.corrienteBateria = this.convertirDwordAIEEE754Float(hexValues[16], hexValues[17], hexValues[18], hexValues[19], false);
        datos.voltajeCargas = this.convertirDwordAIEEE754Float(hexValues[20], hexValues[21], hexValues[22], hexValues[23], false);
        datos.corrienteCargas = this.convertirDwordAIEEE754Float(hexValues[24], hexValues[25], hexValues[26], hexValues[27], false);
        datos.potenciaCargas = this.convertirDwordAIEEE754Float(hexValues[28], hexValues[29], hexValues[30], hexValues[31], false);
        return datos;
      }

      // HSE formato clásico (20 bytes): VS,CS 2B; SW 4B; VB,CB,LV,LC 2B; LP 4B
      if (hexValues.length >= 2) {
        datos.voltajeSolar = this.convertirHexADecimal(hexValues[0], hexValues[1]);
      }

      // Byte 2-3: CS [A] - Corriente Solar
      if (hexValues.length >= 4) {
        datos.corrienteSolar = this.convertirHexADecimal(hexValues[2], hexValues[3]);
      }

      // Byte 4-7: SW [W] - Potencia Solar (32 bits)
      // DWORD: interpretar como IEEE 754. Si no, Little-Endian/Big-Endian según dispositivo.
      const esLittleEndian = (topic ? this.esLuminariaLittleEndian(topic) : false) || !!esLetrero;
      if (hexValues.length >= 8) {
        if (tipoDispositivo === 'DWORD') {
          datos.potenciaSolar = this.convertirDwordAIEEE754Float(hexValues[4], hexValues[5], hexValues[6], hexValues[7], false);
        } else if (esLittleEndian) {
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

      // Byte 16-19: LP [W] - Potencia Cargas (32 bits)
      // DWORD: interpretar como IEEE 754. Si no, Little-Endian/Big-Endian según dispositivo.
      if (hexValues.length >= 20) {
        if (tipoDispositivo === 'DWORD') {
          datos.potenciaCargas = this.convertirDwordAIEEE754Float(hexValues[16], hexValues[17], hexValues[18], hexValues[19], false);
        } else if (esLittleEndian) {
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
    @InjectRepository(Letrero)
    private letreroRepository: Repository<Letrero>,
    @InjectRepository(Barrera)
    private barreraRepository: Repository<Barrera>,
  ) {}

  async onModuleInit() {
    this.logger.log('MqttService inicializado');
    // Intentar conectar automáticamente si hay configuración guardada
    await this.autoConnect();
    
    // Limpiar automáticamente topics /procesado que no son de luminarias al iniciar
    // Esto se ejecuta en segundo plano sin bloquear la inicialización
    this.limpiarTopicsProcesadoNoLuminarias().catch((error) => {
      this.logger.warn(`Error al limpiar topics procesado al iniciar: ${error.message}`);
    });
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
        this.logger.log(`Auto-conectando al broker MQTT: ${config.brokerUrl}${config.username ? ` con usuario: ${config.username}` : ''}`);
        await this.connect(config.brokerUrl, config.autoConnect, config.username, config.password);
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

  async connect(
    brokerUrl: string,
    autoConnect: boolean = true,
    username?: string | null,
    password?: string | null,
  ): Promise<boolean> {
    try {
      if (this.client && this.isConnected) {
        await this.disconnect();
      }

      this.brokerUrl = brokerUrl;
      this.username = username || null;
      this.logger.log(`Conectando al broker MQTT: ${brokerUrl}${username ? ` con usuario: ${username}` : ''}`);

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
            username: username || null,
            password: password || null,
          });
        } else {
          config.brokerUrl = brokerUrl;
          config.autoConnect = autoConnect;
          config.username = username || null;
          config.password = password || null;
        }

        await this.mqttConfigRepository.save(config);
        this.logger.log('Configuración MQTT guardada en la base de datos');
      } catch (dbError) {
        this.logger.error(`Error al guardar configuración MQTT: ${dbError.message}`);
      }

      // Preparar opciones de conexión con autenticación básica si se proporcionan credenciales
      const connectOptions: mqtt.IClientOptions = {
        clientId: `centinela-backend-${Date.now()}`,
        reconnectPeriod: 5000,
        connectTimeout: 30000,
      };

      // Agregar autenticación básica si se proporcionan credenciales
      if (username && password) {
        connectOptions.username = username;
        connectOptions.password = password;
        this.logger.log('Usando autenticación básica para la conexión MQTT');
      }

      this.client = mqtt.connect(brokerUrl, connectOptions);

      this.client.on('connect', async () => {
        this.isConnected = true;
        this.logger.log('Conectado al broker MQTT exitosamente');
        // Cargar topics suscritos desde la base de datos y resuscribir
        await this.loadSubscribedTopicsFromDB();
        // Nota: El evento de conexión se emitirá desde el gateway cuando se resuelva la promesa
      });

      this.client.on('message', async (topic, message) => {
        // Si se recibe un mensaje en un topic /procesado, verificar si es de luminaria / letrero / barrera
        if (topic.endsWith('/procesado')) {
          const topicBase = topic.replace('/procesado', '');
          const esLuminaria = await this.esTopicLuminaria(topicBase);
          const esLetrero = await this.esTopicLetrero(topicBase);
          const esBarrera = await this.esTopicBarrera(topicBase);
          if (!esLuminaria && !esLetrero && !esBarrera) {
            // No es de luminaria, letrero ni barrera configurado: guardar bajo el topic base para que esté en BD y los reportes lo vean
            const timestamp = new Date();
            const messageParaBD = this.procesarMensajeParaBD(message);
            try {
              const messageEntity = this.mqttMessageRepository.create({
                topic: topicBase,
                message: messageParaBD,
                timestamp,
                userId: null,
                username: null,
              });
              await this.mqttMessageRepository.save(messageEntity);
              this.logger.debug(`Mensaje de topic ${topic} guardado bajo topic base ${topicBase} (barrera/letrero)`);
            } catch (error) {
              this.logger.error(`Error al guardar mensaje bajo topic base: ${error.message}`);
            }
            const mqttMessage: MqttMessageInterface = {
              topic: topicBase,
              message: messageParaBD,
              timestamp,
              userId: null,
              username: null,
            };
            this.messageSubject.next(mqttMessage);
            try {
              await this.mqttMessageRepository
                .createQueryBuilder()
                .delete()
                .where('topic = :topic', { topic })
                .execute();
            } catch {
              // ignorar error al limpiar /procesado
            }
            return;
          }
          // Si es de luminaria/letrero/barrera configurado, continuar con el procesamiento normal manteniendo el topic /procesado
        }
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
        
        // Detectar si es una trama HSE (luminaria o letrero) y procesar si es PLC_S
        // Mismo procesamiento para ambos: parsear trama HSE y publicar JSON en topic/procesado
        if (this.esTramaHSE(message)) {
          const esLuminaria = await this.esTopicLuminaria(topic);
          const esLetrero = await this.esTopicLetrero(topic);
          const esBarrera = await this.esTopicBarrera(topic);

          const procesarHSE = async (tipoDispositivo: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD' | null, tipoEntidad: string) => {
            if (tipoDispositivo === 'RPI') {
              this.logger.debug(`Mensaje de RPI recibido en ${topic} (${tipoEntidad}) - datos ya procesados`);
              return;
            }
            const procesarComoPLC = tipoDispositivo === 'PLC_S' || tipoDispositivo === 'PLC_N' || tipoDispositivo === 'DWORD' || !tipoDispositivo;
            if (procesarComoPLC) {
              this.logger.debug(`Procesando señal HSE para ${tipoEntidad} ${topic} (tipo: ${tipoDispositivo || 'PLC_S'})`);
              const esLetreroEntidad = tipoEntidad === 'letrero';
              const datosConvertidos = this.parsearTramaHSE(message, topic, esLetreroEntidad, tipoDispositivo ?? undefined);
              if (datosConvertidos && this.client && this.isConnected) {
                const topicProcesado = `${topic}/procesado`;
                const mensajeProcesado = JSON.stringify(datosConvertidos);
                try {
                  this.client.publish(topicProcesado, mensajeProcesado, { qos: 0 }, (err) => {
                    if (err) {
                      this.logger.error(`Error al publicar mensaje procesado en ${topicProcesado}: ${err.message}`);
                    } else {
                      this.logger.debug(`Mensaje procesado publicado en ${topicProcesado}`);
                    }
                  });
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
                  this.logger.error(`Error al procesar trama HSE: ${error.message}`);
                }
              }
            }
          };

          if (esLuminaria) {
            const tipoDispositivo = await this.obtenerTipoDispositivoLuminaria(topic);
            await procesarHSE(tipoDispositivo, 'luminaria');
          } else if (esLetrero) {
            const tipoDispositivo = await this.obtenerTipoDispositivoLetrero(topic);
            await procesarHSE(tipoDispositivo, 'letrero');
          } else if (esBarrera) {
            const tipoDispositivo = await this.obtenerTipoDispositivoBarrera(topic);
            await procesarHSE(tipoDispositivo, 'barrera');
          } else {
            this.logger.warn(`⚠️ Trama HSE detectada en ${topic} pero no es de luminaria, letrero ni barrera configurado.`);
            this.logger.warn(`   Configura el topic en Configuración de Luminarias, Letreros o Barreras (Settings).`);
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

      // Crear una promesa con timeout para evitar esperas indefinidas
      return new Promise<boolean>((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.logger.error('Timeout al conectar al broker MQTT');
            this.isConnected = false;
            if (this.client) {
              this.client.end();
              this.client = null;
            }
            resolve(false);
          }
        }, 30000); // 30 segundos de timeout

        const onConnect = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.client!.removeListener('connect', onConnect);
            this.client!.removeListener('error', onError);
            this.client!.removeListener('close', onClose);
            resolve(true);
          }
        };

        const onError = (error: Error) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.logger.error(`Error al conectar al broker MQTT: ${error.message}`);
            this.isConnected = false;
            this.client!.removeListener('connect', onConnect);
            this.client!.removeListener('error', onError);
            this.client!.removeListener('close', onClose);
            if (this.client) {
              this.client.end();
              this.client = null;
            }
            resolve(false);
          }
        };

        const onClose = () => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            this.logger.warn('Conexión cerrada antes de establecerse');
            this.isConnected = false;
            this.client!.removeListener('connect', onConnect);
            this.client!.removeListener('error', onError);
            this.client!.removeListener('close', onClose);
            resolve(false);
          }
        };

        this.client!.on('connect', onConnect);
        this.client!.on('error', onError);
        this.client!.on('close', onClose);
      });
    } catch (error) {
      this.logger.error(`Error al conectar: ${error.message}`);
      this.isConnected = false;
      if (this.client) {
        this.client.end();
        this.client = null;
      }
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
      // No limpiar el username, se mantiene para la próxima conexión
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

  async subscribe(topic: string, categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'): Promise<boolean> {
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
                  categoria: categoria ?? 'sin_asignar',
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

  async updateTopicCategory(topic: string, categoria: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'): Promise<boolean> {
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
      username: this.username,
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
   * Limpiar topics /procesado que no son de luminarias, letreros ni barreras
   * Elimina mensajes de /procesado cuyo topic base no está configurado como luminaria, letrero o barrera
   */
  async limpiarTopicsProcesadoNoLuminarias(): Promise<{ eliminados: number; topics: string[] }> {
    try {
      const topicsProcesado = await this.mqttMessageRepository
        .createQueryBuilder('message')
        .select('DISTINCT message.topic', 'topic')
        .where('message.topic LIKE :pattern', { pattern: '%/procesado' })
        .getRawMany();

      const topicsAEliminar: string[] = [];
      let totalEliminados = 0;

      for (const row of topicsProcesado) {
        const topicProcesado = row.topic;
        const topicBase = topicProcesado.replace('/procesado', '');
        const esLuminaria = await this.esTopicLuminaria(topicBase);
        const esLetrero = await this.esTopicLetrero(topicBase);
        const esBarrera = await this.esTopicBarrera(topicBase);

        if (!esLuminaria && !esLetrero && !esBarrera) {
          const resultado = await this.mqttMessageRepository
            .createQueryBuilder()
            .delete()
            .where('topic = :topic', { topic: topicProcesado })
            .execute();
          const eliminados = resultado.affected || 0;
          totalEliminados += eliminados;
          topicsAEliminar.push(topicProcesado);
          this.logger.log(`Eliminados ${eliminados} mensajes del topic ${topicProcesado} (no es luminaria, letrero ni barrera)`);
        }
      }

      return { eliminados: totalEliminados, topics: topicsAEliminar };
    } catch (error) {
      this.logger.error(`Error al limpiar topics procesado: ${error.message}`);
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

  private parseRegistroEnergiaParaExport(
    message: string,
    timestamp: string,
    topic?: string,
  ): {
    timestamp: string;
    VS?: number;
    CS?: number;
    SW?: number;
    VB?: number;
    CB?: number;
    LV?: number;
    LC?: number;
    LP?: number;
  } | null {
    const raw = (message || '').trim();
    if (!raw) return null;

    // 1) Intentar JSON (parsearTramaHSE usa voltajeCargas/corrienteCargas/potenciaCargas — plural)
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      const n = (...candidates: unknown[]) => {
        for (const v of candidates) {
          if (v == null) continue;
          const num = Number(v);
          if (!Number.isNaN(num)) return num;
        }
        return undefined;
      };
      const reg = {
        timestamp,
        VS: n(data.VS, data.voltajeSolar),
        CS: n(data.CS, data.corrienteSolar),
        SW: n(data.SW, data.potenciaSolar),
        VB: n(data.VB, data.voltajeBateria),
        CB: n(data.CB, data.corrienteBateria),
        LV: n(data.LV, data.voltajeCargas, data.voltajeCarga),
        LC: n(data.LC, data.corrienteCargas, data.corrienteCarga),
        LP: n(data.LP, data.potenciaCargas, data.potenciaCarga),
      };
      if (Object.values(reg).some((v) => typeof v === 'number')) return reg;
    } catch {
      // continuar con parser de texto
    }

    // 2) RPI texto: HSE fecha hora VS CS SW VB CB LV LC LP ...
    const rpi = raw.replace(/^HSE(?=\d{6}\b)/i, 'HSE ').split(/\s+/);
    if (/^HSE/i.test(raw) && rpi.length >= 11) {
      const nums = rpi.slice(3).map((s) => parseFloat(s));
      if (nums.length >= 8 && nums.slice(0, 8).every((n) => !Number.isNaN(n))) {
        return {
          timestamp,
          VS: nums[0],
          CS: nums[1],
          SW: nums[2],
          VB: nums[3],
          CB: nums[4],
          LV: nums[5],
          LC: nums[6],
          LP: nums[7],
        };
      }
    }

    // 3) Trama HSE/HSP binaria o hex (misma lógica que ingest; no es JSON ni 8 números separados por espacio)
    if (raw.length >= 20) {
      try {
        const buf = Buffer.from(raw, 'binary');
        if (this.esTramaHSE(buf)) {
          const hse = this.parsearTramaHSE(buf, topic);
          if (hse) {
            const pick = (...vals: unknown[]): number | undefined => {
              for (const v of vals) {
                if (v == null || v === '') continue;
                const num = Number(v);
                if (!Number.isNaN(num)) return num;
              }
              return undefined;
            };
            const out = {
              timestamp,
              VS: pick(hse.voltajeSolar, hse.VS),
              CS: pick(hse.corrienteSolar, hse.CS),
              SW: pick(hse.potenciaSolar, hse.SW),
              VB: pick(hse.voltajeBateria, hse.VB),
              CB: pick(hse.corrienteBateria, hse.CB),
              LV: pick(hse.voltajeCargas, hse.voltajeCarga, hse.LV),
              LC: pick(hse.corrienteCargas, hse.corrienteCarga, hse.LC),
              LP: pick(hse.potenciaCargas, hse.potenciaCarga, hse.LP),
            };
            if (Object.values(out).some((v) => typeof v === 'number')) return out;
          }
        }
      } catch {
        // ignorar
      }
    }

    // 4) Trama barreras: HSE fecha hora VB CB SW ET PT CS VS
    const parts = raw.split(/\s+/);
    if (/^HSE/i.test(raw) && parts.length >= 10) {
      const vb = parseFloat(parts[3]);
      const cb = parseFloat(parts[4]);
      const sw = parseFloat(parts[5]);
      const lp = parseFloat(parts[7]);
      const cs = parseFloat(parts[8]);
      const vs = parseFloat(parts[9]);
      if (![vb, cb, sw, lp, cs, vs].every((n) => Number.isNaN(n))) {
        return {
          timestamp,
          VS: Number.isNaN(vs) ? undefined : vs,
          CS: Number.isNaN(cs) ? undefined : cs,
          SW: Number.isNaN(sw) ? undefined : sw,
          VB: Number.isNaN(vb) ? undefined : vb,
          CB: Number.isNaN(cb) ? undefined : cb,
          LP: Number.isNaN(lp) ? undefined : lp,
        };
      }
    }

    return null;
  }

  async exportarDataBrutaCsv(options: {
    topic: string;
    startDate?: Date;
    endDate?: Date;
    entityName?: string;
  }): Promise<{ buffer: Buffer; filename: string }> {
    if (!options.topic) {
      throw new Error('El topic es requerido para exportar data bruta');
    }

    const qb = this.mqttMessageRepository
      .createQueryBuilder('message')
      .where('message.topic = :topic', { topic: options.topic })
      .orderBy('message.timestamp', 'ASC');

    if (options.startDate) {
      qb.andWhere('message.timestamp >= :startDate', {
        startDate: options.startDate,
      });
    }
    if (options.endDate) {
      qb.andWhere('message.timestamp <= :endDate', {
        endDate: options.endDate,
      });
    }

    const rows = await qb.getMany();
    const escapeCsv = (value: unknown): string => {
      if (value == null) return '';
      const text = String(value);
      const escaped = text.replace(/"/g, '""');
      return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
    };

    const header = [
      'fecha_hora_local',
      'timestamp_utc_iso',
      'topic',
      'message_raw',
      'VS',
      'CS',
      'SW',
      'VB',
      'CB',
      'LV',
      'LC',
      'LP',
    ];
    const lines: string[] = [header.join(',')];

    rows.forEach((row) => {
      const rawMessage = this.procesarMensajeDesdeBD(row.message);
      const ts = new Date(row.timestamp);
      const parsed = this.parseRegistroEnergiaParaExport(
        rawMessage,
        ts.toISOString(),
        options.topic,
      );
      lines.push(
        [
          formatFechaHoraChile(ts),
          ts.toISOString(),
          row.topic,
          rawMessage,
          parsed?.VS ?? '',
          parsed?.CS ?? '',
          parsed?.SW ?? '',
          parsed?.VB ?? '',
          parsed?.CB ?? '',
          parsed?.LV ?? '',
          parsed?.LC ?? '',
          parsed?.LP ?? '',
        ]
          .map((cell) => escapeCsv(cell))
          .join(','),
      );
    });

    const csvContent = `\uFEFF${lines.join('\n')}`;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = (options.entityName || 'dispositivo')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '');
    const filename = `data_bruta_${safeName || 'dispositivo'}_${stamp}.csv`;

    return { buffer: Buffer.from(csvContent, 'utf8'), filename };
  }

  async generarExcelPromedios(options: {
    topic: string;
    startDate?: Date;
    endDate?: Date;
    entityName?: string;
    /** Etiquetas YYYY-MM-DD del filtro (día operacional). Con fechaEtiquetaHasta el backend filtra por ventana 08:00→08:00 Chile. */
    fechaEtiquetaDesde?: string;
    fechaEtiquetaHasta?: string;
  }): Promise<{ buffer: Buffer; filename: string }> {
    const topic = (options.topic || '').trim();
    if (!topic) throw new Error('Topic requerido');

    const qb = this.mqttMessageRepository.createQueryBuilder('message');
    qb.where('message.topic = :topic', { topic });
    if (options.fechaEtiquetaDesde && options.fechaEtiquetaHasta) {
      const { tMin, tMax } = rangoOperacionalQueryUtc(options.fechaEtiquetaDesde, options.fechaEtiquetaHasta);
      qb.andWhere('message.timestamp >= :startDate', { startDate: tMin });
      qb.andWhere('message.timestamp <= :endDate', { endDate: tMax });
    } else {
      if (options.startDate) qb.andWhere('message.timestamp >= :startDate', { startDate: options.startDate });
      if (options.endDate) qb.andWhere('message.timestamp <= :endDate', { endDate: options.endDate });
    }
    qb.orderBy('message.timestamp', 'ASC');

    const rawMessages = await qb.getMany();
    const registros = rawMessages
      .map((m) =>
        this.parseRegistroEnergiaParaExport(
          this.procesarMensajeDesdeBD(m.message),
          new Date(m.timestamp).toISOString(),
          topic,
        ),
      )
      .filter((r): r is NonNullable<typeof r> => !!r);

    const mean = (vals: Array<number | undefined>) => {
      const nums = vals.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
      if (!nums.length) return null;
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    };
    const meanPotenciaBateriaW = (regs: typeof registros): number | null => {
      const products: number[] = [];
      for (const r of regs) {
        if (r.VB != null && r.CB != null && !Number.isNaN(r.VB) && !Number.isNaN(r.CB)) {
          products.push(r.VB * r.CB);
        }
      }
      return mean(products);
    };
    const fmt = (n: number | null | undefined) => (n == null ? '' : Number(n.toFixed(2)));
    const entityName = (options.entityName || 'DISPOSITIVO').toUpperCase();

    /** Día operacional (08:00→08:00), misma regla que el frontend */
    const opsDiaMap = new Map<string, typeof registros>();
    registros.forEach((r) => {
      const k = getDiaOperacionalKeyChile(new Date(r.timestamp));
      if (!opsDiaMap.has(k)) opsDiaMap.set(k, []);
      opsDiaMap.get(k)!.push(r);
    });

    /** Solo muestras en [08:00 del día etiqueta, 07:59 del día siguiente] — coherente con promedio del día en frontend */
    for (const k of Array.from(opsDiaMap.keys())) {
      const bucket = opsDiaMap.get(k)!;
      opsDiaMap.set(
        k,
        bucket.filter((r) => registroEnVentanaOperacionalEtiqueta(new Date(r.timestamp), k)),
      );
    }

    const allEtiquetas =
      options.fechaEtiquetaDesde && options.fechaEtiquetaHasta
        ? enumerarEtiquetasYmdInclusive(options.fechaEtiquetaDesde, options.fechaEtiquetaHasta)
        : Array.from(opsDiaMap.keys());
    allEtiquetas.sort((a, b) => b.localeCompare(a));
    const diasOp = allEtiquetas;

    const promedioVS = mean(registros.map((r) => r.VS));
    const promedioCS = mean(registros.map((r) => r.CS));
    const promedioVB = mean(registros.map((r) => r.VB));
    const promedioSW = mean(registros.map((r) => r.SW));
    const promedioCB = mean(registros.map((r) => r.CB));
    const promedioLV = mean(registros.map((r) => r.LV));
    const promedioLC = mean(registros.map((r) => r.LC));
    const promedioLP = mean(registros.map((r) => r.LP));

    const hourlyRows: Array<Record<string, any>> = [];
    diasOp.forEach((d) => {
      const regs = opsDiaMap.get(d) ?? [];
      if (regs.length === 0) return;
      const hm = new Map<number, typeof registros>();
      regs.forEach((r) => {
        const h = getHourChile(new Date(r.timestamp));
        if (Number.isNaN(h)) return;
        if (!hm.has(h)) hm.set(h, []);
        hm.get(h)!.push(r);
      });
      Array.from(hm.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([h, arr]) => {
          const row: Record<string, any> = {
            Fecha: d,
            VentanaDia: formatoVentanaOperativaCorta(d),
            Hora: `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59 (${arr.length} muestras)`,
            ID: entityName,
          };
          row.VSp = fmt(mean(arr.map((r) => r.VS)));
          row.CSp = fmt(mean(arr.map((r) => r.CS)));
          row.SWp = fmt(mean(arr.map((r) => r.SW)));
          row.VBp = fmt(mean(arr.map((r) => r.VB)));
          row.CBp = fmt(mean(arr.map((r) => r.CB)));
          const bw = meanPotenciaBateriaW(arr);
          row.BW = bw != null ? Number(bw.toFixed(2)) : '';
          row.LVp = fmt(mean(arr.map((r) => r.LV)));
          row.LCp = fmt(mean(arr.map((r) => r.LC)));
          row.LPp = fmt(mean(arr.map((r) => r.LP)));
          hourlyRows.push(row);
        });
    });
    const hourlyRowsByDate = new Map<string, Array<Record<string, any>>>();
    hourlyRows.forEach((row) => {
      if (!hourlyRowsByDate.has(row.Fecha)) {
        hourlyRowsByDate.set(row.Fecha, []);
      }
      hourlyRowsByDate.get(row.Fecha)!.push(row);
    });

    /** Promedio por hora del reloj (0–23) en todo el periodo; solo horas con al menos un registro. */
    const hourlyResumenGeneralRows: Array<Record<string, any>> = (() => {
      const byHourOfDay = new Map<number, typeof registros>();
      registros.forEach((r) => {
        const h = getHourChile(new Date(r.timestamp));
        if (Number.isNaN(h)) return;
        if (!byHourOfDay.has(h)) byHourOfDay.set(h, []);
        byHourOfDay.get(h)!.push(r);
      });
      const rows: Array<Record<string, any>> = [];
      Array.from(byHourOfDay.entries())
        .sort((a, b) => a[0] - b[0])
        .forEach(([h, arr]) => {
          const row: Record<string, any> = {
            Fecha: 'Periodo completo',
            Hora: `${String(h).padStart(2, '0')}:00–${String(h).padStart(2, '0')}:59 (${arr.length} muestras)`,
            ID: entityName,
          };
          row.VSp = fmt(mean(arr.map((r) => r.VS)));
          row.CSp = fmt(mean(arr.map((r) => r.CS)));
          row.SWp = fmt(mean(arr.map((r) => r.SW)));
          row.VBp = fmt(mean(arr.map((r) => r.VB)));
          row.CBp = fmt(mean(arr.map((r) => r.CB)));
          const bwG = meanPotenciaBateriaW(arr);
          row.BW = bwG != null ? Number(bwG.toFixed(2)) : '';
          row.LVp = fmt(mean(arr.map((r) => r.LV)));
          row.LCp = fmt(mean(arr.map((r) => r.LC)));
          row.LPp = fmt(mean(arr.map((r) => r.LP)));
          rows.push(row);
        });
      return rows;
    })();

    const anomalies = registros
      .map((r) => {
        const issues: string[] = [];
        let sev: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
        if (r.VB != null && (r.VB < 10 || r.VB > 80)) {
          issues.push(`VB fuera de rango (${r.VB.toFixed(2)})`);
          sev = 'ALTA';
        }
        if (r.SW != null && r.SW < 0) {
          issues.push(`SW negativa (${r.SW.toFixed(2)})`);
          sev = 'ALTA';
        }
        if (r.CB != null && r.CB < 0) {
          issues.push(`CB negativa (${r.CB.toFixed(2)})`);
          sev = 'MEDIA';
        }
        const faltantes = ['VS', 'CS', 'SW', 'VB', 'CB', 'LV', 'LC', 'LP'].filter((k) => (r as any)[k] == null);
        if (faltantes.length >= 4) {
          issues.push(`Campos faltantes: ${faltantes.join(', ')}`);
          if (sev === 'BAJA') sev = 'MEDIA';
        }
        if (!issues.length) return null;
        return { ...r, severidad: sev, detalle: issues.join(' | ') };
      })
      .filter((x): x is NonNullable<typeof x> => !!x);

    const wb = new ExcelJS.Workbook();
    const titleStyle = {
      font: { bold: true, size: 14, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF15803D' } },
      alignment: { vertical: 'middle', horizontal: 'left' },
    } as const;

    const notas = wb.addWorksheet('Notas');
    notas.mergeCells('A1:H1');
    notas.getCell('A1').value = 'INFORMACIÓN Y METODOLOGÍA';
    Object.assign(notas.getCell('A1'), titleStyle);
    notas.addRows([
      [
        'Zona horaria: America/Santiago (Chile). Horas y fechas del informe en hora civil de Chile.',
      ],
      [
        'Día operacional: la etiqueta YYYY-MM-DD es el día en que empieza el turno a las 08:00. Ventana = ese día 08:00 hasta el día siguiente 07:59. Ej.: etiqueta 2026-03-28 = 28/03 08:00 → 29/03 07:59. Filtro Desde 2026-03-28 Hasta 2026-03-29 = dos días operativos (28→29 y 29→30).',
      ],
      [
        'BW (potencia batería): media de (VB×CB) en cada muestra del grupo (hora o día), no (media VB)×(media CB). Coherente con la pantalla Promedios.',
      ],
      [
        'Promedio del día: muestras entre 08:00 del día de la etiqueta y 07:59 del día siguiente. Ej.: etiqueta 2026-03-28 = 28/03 08:00 → 29/03 07:59.',
      ],
      [
        'Promedios horarios (LPp, VBp, etc.): media aritmética de todas las muestras MQTT en esa hora de reloj Chile (00–59 min).',
      ],
      [
        'Tabla de registros (muestras puntuales): cada fila es una medición en un instante. Es normal que LP (u otras magnitudes) sea distinto del promedio horario: por ejemplo, LP entre 300–400 W en varias muestras puede dar un promedio horario de 450–600 W si hubo picos u otras muestras más altas en la misma hora.',
      ],
      [
        'Columna fecha/hora en "Datos originales": formato local del informe (es-CL). El instante UTC interno de la base se muestra de forma legible para evitar confusiones al abrir el archivo en otro huso horario.',
      ],
    ]);
    notas.getColumn(1).width = 100;

    const resumen = wb.addWorksheet('Resumen');
    resumen.mergeCells('A1:H1');
    resumen.getCell('A1').value = 'INFORMACION GENERAL';
    Object.assign(resumen.getCell('A1'), titleStyle);
    const primera = registros[0]
      ? formatFechaHoraChile(new Date(registros[0].timestamp))
      : '';
    const ultima = registros.length
      ? formatFechaHoraChile(new Date(registros[registros.length - 1].timestamp))
      : '';
    resumen.addRows([
      ['Total de registros', registros.length],
      ...(options.fechaEtiquetaDesde && options.fechaEtiquetaHasta
        ? ([
            [
              'Filtro exportación (etiquetas día operacional)',
              `${options.fechaEtiquetaDesde} → ${options.fechaEtiquetaHasta} (${diasOp.length} día(s) en el archivo)`,
            ],
          ] as [string, string][])
        : []),
      ['Rango de fechas', `${primera} - ${ultima}`],
      ['Días operacionales analizados', diasOp.length],
      ['Promedio VS', fmt(promedioVS)],
      ['Promedio CS', fmt(promedioCS)],
      ['Promedio SW', fmt(promedioSW)],
      ['Promedio VB', fmt(promedioVB)],
      ['Promedio CB', fmt(promedioCB)],
      ['Promedio LV', fmt(promedioLV)],
      ['Promedio LC', fmt(promedioLC)],
      ['Promedio LP', fmt(promedioLP)],
    ]);
    resumen.addRow([]);
    resumen.addRow([
      'PROMEDIOS POR HORARIO - RESUMEN GENERAL (solo horas con registros en el periodo)',
    ]);
    resumen.addRow([
      'Fecha',
      'Hora',
      'ID',
      'VSp',
      'CSp',
      'SWp',
      'VBp',
      'CBp',
      'BW',
      'LVp',
      'LCp',
      'LPp',
    ]);
    resumen.addRows(
      hourlyResumenGeneralRows.map((r) => [
        r.Fecha,
        r.Hora,
        r.ID,
        r.VSp,
        r.CSp,
        r.SWp,
        r.VBp,
        r.CBp,
        r.BW,
        r.LVp,
        r.LCp,
        r.LPp,
      ]),
    );
    resumen.addRow([]);
    resumen.addRow([
      'PROMEDIOS POR HORARIO - POR DÍA OPERACIONAL (etiqueta = día de inicio 08:00; ventana hasta 07:59 del día siguiente)',
    ]);
    diasOp.forEach((fecha) => {
      const rows = hourlyRowsByDate.get(fecha) ?? [];
      const ventana = formatoVentanaOperativaCorta(fecha);
      const diaTitle = resumen.addRow([`DÍA OPERACIONAL ${fecha}  |  ${ventana}`]);
      resumen.mergeCells(`A${diaTitle.number}:L${diaTitle.number}`);
      if (rows.length === 0) {
        resumen.addRow([
          'Etiqueta',
          'Ventana',
          'Hora',
          'ID',
          'VSp',
          'CSp',
          'SWp',
          'VBp',
          'CBp',
          'BW',
          'LVp',
          'LCp',
          'LPp',
        ]);
        resumen.addRow([
          fecha,
          ventana,
          'Sin registros en este día operativo',
          entityName,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
        resumen.addRow([]);
        return;
      }
      resumen.addRow([
        'Etiqueta día',
        'Ventana',
        'Hora',
        'ID',
        'VSp',
        'CSp',
        'SWp',
        'VBp',
        'CBp',
        'BW',
        'LVp',
        'LCp',
        'LPp',
      ]);
      rows.forEach((r) => {
        resumen.addRow([
          r.Fecha,
          r.VentanaDia ?? ventana,
          r.Hora,
          r.ID,
          r.VSp,
          r.CSp,
          r.SWp,
          r.VBp,
          r.CBp,
          r.BW,
          r.LVp,
          r.LCp,
          r.LPp,
        ]);
      });
      resumen.addRow([]);
    });

    const datos = wb.addWorksheet('Datos originales');
    datos.mergeCells('A1:I1');
    datos.getCell('A1').value = 'DATOS ORIGINALES';
    Object.assign(datos.getCell('A1'), titleStyle);
    datos.addRows([
      ['ESTADISTICAS RESUMIDAS'],
      ['Total de registros', registros.length],
      ['Primera fecha/hora', primera],
      ['Última fecha/hora', ultima],
      ['Promedio VS', fmt(promedioVS)],
      ['Promedio CS', fmt(promedioCS)],
      ['Promedio SW', fmt(promedioSW)],
      ['Promedio VB', fmt(promedioVB)],
      ['Promedio CB', fmt(promedioCB)],
      ['Promedio LV', fmt(promedioLV)],
      ['Promedio LC', fmt(promedioLC)],
      ['Promedio LP', fmt(promedioLP)],
      [],
      ['fecha_hora_local', 'VS', 'CS', 'SW', 'VB', 'CB', 'LV', 'LC', 'LP'],
    ]);
    registros.forEach((r) =>
      datos.addRow([
        formatFechaHoraChile(new Date(r.timestamp)),
        fmt(r.VS),
        fmt(r.CS),
        fmt(r.SW),
        fmt(r.VB),
        fmt(r.CB),
        fmt(r.LV),
        fmt(r.LC),
        fmt(r.LP),
      ]),
    );

    const anom = wb.addWorksheet('Anomalias');
    anom.mergeCells('A1:H1');
    anom.getCell('A1').value = 'ANOMALIAS DETECTADAS - ANALISIS DE CALIDAD DE DATOS';
    Object.assign(anom.getCell('A1'), titleStyle);
    const alta = anomalies.filter((a) => a.severidad === 'ALTA').length;
    const media = anomalies.filter((a) => a.severidad === 'MEDIA').length;
    const baja = anomalies.filter((a) => a.severidad === 'BAJA').length;
    anom.addRows([
      ['ESTADISTICAS RESUMIDAS'],
      ['Total de anomalias', anomalies.length],
      ['Alta severidad', alta],
      ['Media severidad', media],
      ['Baja severidad', baja],
      ['Porcentaje de anomalias', registros.length ? `${((anomalies.length / registros.length) * 100).toFixed(2)}%` : '0%'],
      [],
      ['MEDIA SEVERIDAD'],
      ['timestamp', 'detalle', 'VB', 'SW', 'CB'],
    ]);
    anomalies
      .filter((a) => a.severidad === 'MEDIA')
      .forEach((a) =>
        anom.addRow([
          formatFechaHoraChile(new Date(a.timestamp)),
          a.detalle,
          fmt(a.VB),
          fmt(a.SW),
          fmt(a.CB),
        ]),
      );

    const promDiarios = wb.addWorksheet('Promedios diarios');
    promDiarios.mergeCells('A1:M1');
    promDiarios.getCell('A1').value =
      'PROMEDIOS DIARIOS - UNA FILA POR ETIQUETA (08:00→08:00); INCLUYE DÍAS SIN REGISTROS';
    Object.assign(promDiarios.getCell('A1'), titleStyle);
    const diarios = diasOp.map((d) => {
      const arr = opsDiaMap.get(d) ?? [];
      const ventana = formatoVentanaOperativaCorta(d);
      if (arr.length === 0) {
        return {
          Fecha: d,
          Ventana: ventana,
          Estado: 'Sin registros',
          Registros: 0,
          VSP: '',
          CSP: '',
          SWP: '',
          VBP: '',
          CBP: '',
          BWP: '',
          LVP: '',
          LCP: '',
          LPP: '',
        };
      }
      const VS = mean(arr.map((r) => r.VS));
      const CS = mean(arr.map((r) => r.CS));
      const SW = mean(arr.map((r) => r.SW));
      const VB = mean(arr.map((r) => r.VB));
      const CB = mean(arr.map((r) => r.CB));
      const BW = meanPotenciaBateriaW(arr);
      const LV = mean(arr.map((r) => r.LV));
      const LC = mean(arr.map((r) => r.LC));
      const LP = mean(arr.map((r) => r.LP));
      return {
        Fecha: d,
        Ventana: ventana,
        Estado: 'OK',
        Registros: arr.length,
        VSP: fmt(VS),
        CSP: fmt(CS),
        SWP: fmt(SW),
        VBP: fmt(VB),
        CBP: fmt(CB),
        BWP: BW != null ? fmt(BW) : '',
        LVP: fmt(LV),
        LCP: fmt(LC),
        LPP: fmt(LP),
      };
    });
    promDiarios.addRows([
      ['ESTADISTICAS RESUMIDAS'],
      ['Total de registros procesados', registros.length],
      ['Etiquetas de día en el informe', diasOp.length],
      ['Promedio VS general', fmt(promedioVS)],
      ['Promedio CS general', fmt(promedioCS)],
      ['Promedio SW general', fmt(promedioSW)],
      ['Promedio VB general', fmt(promedioVB)],
      ['Promedio CB general', fmt(promedioCB)],
      ['Promedio LV general', fmt(promedioLV)],
      ['Promedio LC general', fmt(promedioLC)],
      ['Promedio LP general', fmt(promedioLP)],
      [],
      [
        'PROMEDIOS DIARIOS: media de todas las muestras en la ventana (08:00 del día etiqueta → 07:59 del día siguiente). Ej.: etiqueta 2026-03-28 = 28/03 08:00 → 29/03 07:59.',
      ],
      [
        'Etiqueta día',
        'Ventana operativa',
        'Estado',
        'Registros',
        'VSp',
        'CSp',
        'SWp',
        'VBp',
        'CBp',
        'BW',
        'LVp',
        'LCp',
        'LPp',
      ],
    ]);
    diarios.forEach((r) =>
      promDiarios.addRow([
        r.Fecha,
        r.Ventana,
        r.Estado,
        r.Registros,
        r.VSP,
        r.CSP,
        r.SWP,
        r.VBP,
        r.CBP,
        r.BWP,
        r.LVP,
        r.LCP,
        r.LPP,
      ]),
    );

    const promHoras = wb.addWorksheet('Promedios horarios');
    promHoras.mergeCells('A1:L1');
    promHoras.getCell('A1').value = 'PROMEDIOS HORARIOS ORGANIZADOS POR DIAS';
    Object.assign(promHoras.getCell('A1'), titleStyle);
    promHoras.addRows([
      ['ESTADISTICAS RESUMIDAS'],
      ['Total dias operacionales', diasOp.length],
      ['Total de horas', hourlyRows.length],
      ['Primera fecha', primera],
      ['Ultima fecha', ultima],
      ['Promedio general VS', fmt(promedioVS)],
      ['Promedio general CS', fmt(promedioCS)],
      ['Promedio general SW', fmt(promedioSW)],
      ['Promedio general VB', fmt(promedioVB)],
      ['Promedio general CB', fmt(promedioCB)],
      ['Promedio general LV', fmt(promedioLV)],
      ['Promedio general LC', fmt(promedioLC)],
      ['Promedio general LP', fmt(promedioLP)],
      [],
    ]);
    diasOp.forEach((fecha) => {
      const rows = hourlyRowsByDate.get(fecha) ?? [];
      const ventana = formatoVentanaOperativaCorta(fecha);
      const diaTitle = promHoras.addRow([`DÍA OPERACIONAL ${fecha}  |  ${ventana}`]);
      promHoras.mergeCells(`A${diaTitle.number}:L${diaTitle.number}`);
      if (rows.length === 0) {
        promHoras.addRow([
          'Etiqueta',
          'Ventana',
          'Hora',
          'ID',
          'VSp',
          'CSp',
          'SWp',
          'VBp',
          'CBp',
          'BW',
          'LVp',
          'LCp',
          'LPp',
        ]);
        promHoras.addRow([
          fecha,
          ventana,
          'Sin registros en este día operativo',
          entityName,
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ]);
        promHoras.addRow([]);
        return;
      }
      promHoras.addRow([
        'Etiqueta día',
        'Ventana',
        'Hora',
        'ID',
        'VSp',
        'CSp',
        'SWp',
        'VBp',
        'CBp',
        'BW',
        'LVp',
        'LCp',
        'LPp',
      ]);
      rows.forEach((r) => {
        promHoras.addRow([
          r.Fecha,
          r.VentanaDia ?? ventana,
          r.Hora,
          r.ID,
          r.VSp,
          r.CSp,
          r.SWp,
          r.VBp,
          r.CBp,
          r.BW,
          r.LVp,
          r.LCp,
          r.LPp,
        ]);
      });
      promHoras.addRow([]);
    });

    const resumenes = wb.addWorksheet('Resumenes diarios');
    resumenes.mergeCells('A1:N1');
    resumenes.getCell('A1').value = 'RESUMENES DIARIOS - ANALISIS COMPLETO POR DIA';
    Object.assign(resumenes.getCell('A1'), titleStyle);
    resumenes.addRows([
      ['ESTADISTICAS RESUMIDAS'],
      ['Dias operacionales (etiquetas)', diasOp.length],
      ['Registros', registros.length],
      [],
      [
        'Etiqueta día',
        'Ventana',
        'Estado',
        'Registros',
        'VSp',
        'CSp',
        'SWp',
        'VBp',
        'CBp',
        'BW',
        'LVp',
        'LCp',
        'LPp',
        'Anomalias',
      ],
    ]);
    diarios.forEach((d) => {
      const anomDia = anomalies.filter(
        (a) => getDiaOperacionalKeyChile(new Date(a.timestamp)) === d.Fecha,
      ).length;
      resumenes.addRow([
        d.Fecha,
        d.Ventana,
        d.Estado,
        d.Registros,
        d.VSP,
        d.CSP,
        d.SWP,
        d.VBP,
        d.CBP,
        d.BWP,
        d.LVP,
        d.LCP,
        d.LPP,
        anomDia,
      ]);
    });

    const isHeaderRow = (values: any[]) => {
      const norm = values.map((v) =>
        typeof v === 'string' ? v.trim().toLowerCase() : '',
      );
      const hasFecha = norm.includes('fecha') || norm.includes('date');
      const hasHora = norm.includes('hora') || norm.includes('time');
      const hasReg = norm.includes('registros') || norm.includes('record');
      const hasVS = norm.includes('vs') || norm.includes('vsp');
      return (
        (hasFecha && (hasHora || hasReg)) ||
        (norm.includes('timestamp') && hasVS) ||
        (hasReg && hasVS)
      );
    };

    const isSectionTitle = (v: any) =>
      typeof v === 'string' &&
      (v.includes('ESTADISTICAS') ||
        v.includes('PROMEDIOS') ||
        v.includes('INFORMACION GENERAL') ||
        v.includes('DATOS ORIGINALES') ||
        v.includes('ANOMALIAS DETECTADAS') ||
        v.includes('RESUMENES DIARIOS') ||
        v.includes('MEDIA SEVERIDAD') ||
        v.includes('DIA:') ||
        v.includes('DÍA OPERACIONAL'));

    wb.creator = 'Centinela';
    wb.lastModifiedBy = 'Centinela Backend';
    wb.created = new Date();
    wb.modified = new Date();

    wb.eachSheet((s) => {
      s.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

      // Anchos por defecto legibles
      s.columns = (s.columns || []).map((c, idx) => ({
        ...c,
        width: idx === 0 ? 26 : idx <= 2 ? 20 : 13,
      }));

      s.eachRow((row, rowNumber) => {
        const values = (row.values as any[]).slice(1);
        const first = values[0];

        // Bordes y alineación base
        row.eachCell((cell) => {
          cell.alignment = {
            vertical: 'middle',
            horizontal: 'center',
            wrapText: true,
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
            right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          };
          if (typeof cell.value === 'number') {
            cell.numFmt = '0.00';
          }
        });

        // Fila de título principal
        if (rowNumber === 1) {
          row.height = 30;
          row.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF15803D' },
          };
          row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          return;
        }

        // Subtítulos de sección
        if (isSectionTitle(first)) {
          row.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1F4E78' },
          };
          return;
        }

        // Encabezados de tabla
        if (isHeaderRow(values)) {
          row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF16A34A' },
          };
          return;
        }

        // Zebra para datos
        if (rowNumber % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF7FAFF' },
          };
        }

        // Resaltado especial en hoja Anomalias para severidad
        if (s.name === 'Anomalias') {
          const sevCell = row.getCell(6);
          const sev =
            typeof sevCell.value === 'string'
              ? sevCell.value.toLowerCase()
              : '';
          if (sev.includes('alta')) {
            sevCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFECACA' },
            };
            sevCell.font = { bold: true, color: { argb: 'FFB91C1C' } };
          } else if (sev.includes('media')) {
            sevCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFF00' },
            };
            sevCell.font = { bold: true, color: { argb: 'FF111827' } };
          } else if (sev.includes('baja')) {
            sevCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFBBF7D0' },
            };
            sevCell.font = { bold: true, color: { argb: 'FF166534' } };
          }
        }
      });
    });

    const arr = await wb.xlsx.writeBuffer();
    const buffer = Buffer.from(arr);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const safeName = (options.entityName || 'dispositivo')
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gi, '_')
      .replace(/^_+|_+$/g, '');
    const rangePart =
      options.fechaEtiquetaDesde && options.fechaEtiquetaHasta
        ? `${options.fechaEtiquetaDesde}_${options.fechaEtiquetaHasta}`
        : options.startDate && options.endDate
          ? `${options.startDate.toISOString().slice(0, 10)}_${options.endDate.toISOString().slice(0, 10)}`
          : 'sin_rango';
    return {
      buffer,
      filename: `analisis_promedios_${safeName || 'dispositivo'}_${rangePart}_${stamp}.xlsx`,
    };
  }
}

