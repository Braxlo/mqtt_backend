#!/usr/bin/env node

/**
 * Script de Parsing Automático de Tramas HSE de Luminarias
 * 
 * Este script:
 * 1. Se conecta a un broker MQTT
 * 2. Se suscribe a topics de luminarias
 * 3. Detecta tramas HSE
 * 4. Parsea los valores hexadecimales a decimales
 * 5. Publica en dos tópicos:
 *    - Tópico original: trama cruda
 *    - Tópico procesado: valores convertidos en JSON
 * 
 * Uso:
 *   node parse-luminaria-mqtt.js --broker mqtt://192.168.64.174 --topic LM016
 *   node parse-luminaria-mqtt.js --broker mqtt://192.168.64.174 --topic LM016 --topic LM017
 */

const mqtt = require('mqtt');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// Configuración de argumentos
const argv = yargs(hideBin(process.argv))
  .option('broker', {
    alias: 'b',
    type: 'string',
    description: 'URL del broker MQTT (ej: mqtt://192.168.64.174)',
    demandOption: true,
  })
  .option('topic', {
    alias: 't',
    type: 'array',
    description: 'Topics a suscribir (puede especificarse múltiples veces)',
    demandOption: true,
  })
  .option('verbose', {
    alias: 'v',
    type: 'boolean',
    description: 'Mostrar logs detallados',
    default: false,
  })
  .help()
  .argv;

const BROKER_URL = argv.broker;
const TOPICS = Array.isArray(argv.topic) ? argv.topic : [argv.topic];
const VERBOSE = argv.verbose;

/**
 * Convierte un valor hexadecimal (2 bytes = 4 caracteres hex) a un número decimal
 * Aplica la fórmula: convertir 4 caracteres hex a decimal, luego dividir por 100
 */
function convertirHexADecimal(hexAlto, hexBajo) {
  try {
    const hexCompleto = hexAlto + hexBajo;
    const valorDecimal = parseInt(hexCompleto, 16);
    const valorFinal = valorDecimal / 100;
    return Math.round(valorFinal * 100) / 100; // Redondear a 2 decimales
  } catch (error) {
    console.error("Error al convertir hexadecimal:", error);
    return 0;
  }
}

/**
 * Convierte un valor hexadecimal de 32 bits (4 bytes = 8 caracteres hex) a un número decimal
 * Los 32 bits están divididos en High (4 chars) y Low (4 chars)
 * Aplica la fórmula: (High * 65536 + Low) / 100
 */
function convertirHex32BitsADecimal(hexHigh1, hexHigh2, hexLow1, hexLow2) {
  try {
    const hexHigh = hexHigh1 + hexHigh2;
    const hexLow = hexLow1 + hexLow2;
    
    const valorHigh = parseInt(hexHigh, 16);
    const valorLow = parseInt(hexLow, 16);
    
    const valor32Bits = valorHigh * 65536 + valorLow;
    const valorFinal = valor32Bits / 100;
    return Math.round(valorFinal * 100) / 100; // Redondear a 2 decimales
  } catch (error) {
    console.error("Error al convertir hexadecimal de 32 bits:", error);
    return 0;
  }
}

/**
 * Detecta si un mensaje es una trama HSE del regulador de carga (luminaria)
 */
function esTramaHSE(buffer) {
  const messageStr = buffer.toString('utf8', 0, Math.min(20, buffer.length));
  const patronHSE = /^HSE\s+\d{6}\s+\d{4}\s+/i;
  return patronHSE.test(messageStr);
}

/**
 * Verifica si un topic es una luminaria que requiere orden Little-Endian (16, 17, 18, 19)
 */
function esLuminariaLittleEndian(topic) {
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
function parsearTramaHSE(buffer, topic) {
  try {
    const messageStr = buffer.toString('binary');
    const cleaned = messageStr.trim();

    if (!cleaned.toUpperCase().startsWith("HSE")) {
      return null;
    }

    // Buscar el patrón HSE + fecha + hora + espacio
    // IMPORTANTE: La trama real tiene un espacio adicional después de la hora
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
    const bytes = [];
    for (let i = inicioDatos; i < buffer.length; i++) {
      bytes.push(buffer[i]);
    }

    if (bytes.length < 20) {
      console.warn(`⚠️  Trama HSE incompleta: solo ${bytes.length} bytes (se requieren al menos 20)`);
      return null;
    }

    const hexValues = bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase());

    const datos = {
      fecha,
      hora,
      timestamp: new Date().toISOString(),
    };

    // Byte 0-1: VS [V] - Voltaje Solar
    if (hexValues.length >= 2) {
      datos.voltajeSolar = convertirHexADecimal(hexValues[0], hexValues[1]);
    }

    // Byte 2-3: CS [A] - Corriente Solar
    if (hexValues.length >= 4) {
      datos.corrienteSolar = convertirHexADecimal(hexValues[2], hexValues[3]);
    }

    // Byte 4-7: SW [W] - Potencia Solar (32 bits)
    // IMPORTANTE: Para LM016-019, los bytes vienen en Little-Endian (Low primero, High después)
    // En el mensaje: byte 4-5 = Low, byte 6-7 = High
    // La función espera: High primero, Low después
    const esLittleEndian = topic ? esLuminariaLittleEndian(topic) : false;
    if (hexValues.length >= 8) {
      if (esLittleEndian) {
        // Orden Little-Endian: Low primero, High después en el mensaje
        datos.potenciaSolar = convertirHex32BitsADecimal(
          hexValues[6], hexValues[7],  // High (bytes 6-7 del mensaje)
          hexValues[4], hexValues[5]   // Low (bytes 4-5 del mensaje)
        );
      } else {
        // Orden Big-Endian estándar: High primero, Low después en el mensaje
        datos.potenciaSolar = convertirHex32BitsADecimal(
          hexValues[4], hexValues[5],  // High
          hexValues[6], hexValues[7]   // Low
        );
      }
    }

    // Byte 8-9: VB [V] - Voltaje Batería
    if (hexValues.length >= 10) {
      datos.voltajeBateria = convertirHexADecimal(hexValues[8], hexValues[9]);
    }

    // Byte 10-11: CB [A] - Corriente Batería
    if (hexValues.length >= 12) {
      datos.corrienteBateria = convertirHexADecimal(hexValues[10], hexValues[11]);
    }

    // Byte 12-13: LV [V] - Voltaje Cargas
    if (hexValues.length >= 14) {
      datos.voltajeCargas = convertirHexADecimal(hexValues[12], hexValues[13]);
    }

    // Byte 14-15: LC [A] - Corriente Cargas
    if (hexValues.length >= 16) {
      datos.corrienteCargas = convertirHexADecimal(hexValues[14], hexValues[15]);
    }

    // Byte 16-19: LP [W] - Potencia Cargas / Luminosidad (32 bits)
    // IMPORTANTE: Para LM016-019, los bytes vienen en Little-Endian (Low primero, High después)
    // En el mensaje: byte 16-17 = Low, byte 18-19 = High
    // La función espera: High primero, Low después
    // Ejemplo: 2D 8B 00 01 → Low=2D8B (11659), High=0001 (1) → (1*65536 + 11659)/100 = 771.95
    if (hexValues.length >= 20) {
      if (esLittleEndian) {
        // Orden Little-Endian: Low primero, High después en el mensaje
        datos.potenciaCargas = convertirHex32BitsADecimal(
          hexValues[18], hexValues[19],  // High (bytes 18-19 del mensaje)
          hexValues[16], hexValues[17]   // Low (bytes 16-17 del mensaje)
        );
      } else {
        // Orden Big-Endian estándar: High primero, Low después en el mensaje
        datos.potenciaCargas = convertirHex32BitsADecimal(
          hexValues[16], hexValues[17],  // High
          hexValues[18], hexValues[19]  // Low
        );
      }
    }

    return datos;
  } catch (error) {
    console.error(`❌ Error al parsear trama HSE: ${error.message}`);
    return null;
  }
}

/**
 * Formatea un buffer a hexadecimal para visualización
 */
function formatearHex(buffer) {
  return Array.from(buffer)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

// Conectar al broker MQTT
console.log(`🔌 Conectando al broker: ${BROKER_URL}`);
const client = mqtt.connect(BROKER_URL, {
  reconnectPeriod: 5000,
  connectTimeout: 10000,
});

client.on('connect', () => {
  console.log(`✅ Conectado al broker MQTT`);
  
  // Suscribirse a todos los topics especificados
  TOPICS.forEach(topic => {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`❌ Error al suscribirse a ${topic}:`, err.message);
      } else {
        console.log(`📡 Suscrito a: ${topic}`);
      }
    });
  });
});

client.on('message', (topic, message) => {
  const timestamp = new Date().toISOString();
  
  if (VERBOSE) {
    console.log(`\n📨 Mensaje recibido en ${topic} [${timestamp}]`);
    console.log(`   Tamaño: ${message.length} bytes`);
  }
  
  // Detectar si es una trama HSE
  if (esTramaHSE(message)) {
    console.log(`\n🔍 Trama HSE detectada en ${topic}`);
    
    if (VERBOSE) {
      const hexPreview = formatearHex(message.slice(0, Math.min(50, message.length)));
      console.log(`   Hex preview: ${hexPreview}${message.length > 50 ? '...' : ''}`);
    }
    
    // Parsear la trama
    const datosConvertidos = parsearTramaHSE(message, topic);
    
    if (datosConvertidos) {
      console.log(`✅ Trama parseada correctamente:`);
      console.log(`   Fecha: ${datosConvertidos.fecha} ${datosConvertidos.hora}`);
      console.log(`   VS: ${datosConvertidos.voltajeSolar?.toFixed(2) || 'N/A'} V`);
      console.log(`   CS: ${datosConvertidos.corrienteSolar?.toFixed(2) || 'N/A'} A`);
      console.log(`   SW: ${datosConvertidos.potenciaSolar?.toFixed(2) || 'N/A'} W`);
      console.log(`   VB: ${datosConvertidos.voltajeBateria?.toFixed(2) || 'N/A'} V`);
      console.log(`   CB: ${datosConvertidos.corrienteBateria?.toFixed(2) || 'N/A'} A`);
      console.log(`   LV: ${datosConvertidos.voltajeCargas?.toFixed(2) || 'N/A'} V`);
      console.log(`   LC: ${datosConvertidos.corrienteCargas?.toFixed(2) || 'N/A'} A`);
      console.log(`   LP: ${datosConvertidos.potenciaCargas?.toFixed(2) || 'N/A'} W`);
      
      // Crear tópico procesado
      const topicProcesado = `${topic}/procesado`;
      const mensajeProcesado = JSON.stringify(datosConvertidos);
      
      // Publicar en el tópico procesado
      client.publish(topicProcesado, mensajeProcesado, { qos: 0 }, (err) => {
        if (err) {
          console.error(`❌ Error al publicar en ${topicProcesado}:`, err.message);
        } else {
          console.log(`📤 Publicado en ${topicProcesado}`);
          if (VERBOSE) {
            console.log(`   Mensaje: ${mensajeProcesado}`);
          }
        }
      });
    } else {
      console.warn(`⚠️  No se pudo parsear la trama HSE`);
    }
  } else if (VERBOSE) {
    console.log(`   (No es una trama HSE)`);
  }
});

client.on('error', (error) => {
  console.error(`❌ Error MQTT:`, error.message);
});

client.on('close', () => {
  console.log(`🔌 Conexión cerrada`);
});

client.on('offline', () => {
  console.log(`⚠️  Cliente desconectado, intentando reconectar...`);
});

// Manejar cierre del proceso
process.on('SIGINT', () => {
  console.log(`\n👋 Cerrando conexión...`);
  client.end();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n👋 Cerrando conexión...`);
  client.end();
  process.exit(0);
});
