/**
 * Script para limpiar topics /procesado que no son de luminarias
 * 
 * Este script elimina todos los mensajes de topics que terminan en /procesado
 * pero cuyo topic base no es de luminarias (por ejemplo, BAR5/procesado, CA021/procesado, etc.)
 * 
 * Uso:
 *   node scripts/cleanup-procesado-topics.js
 * 
 * Requiere:
 *   - Base de datos configurada
 *   - Variables de entorno configuradas
 */

require('dotenv').config();
const { DataSource } = require('typeorm');
const path = require('path');

// Importar entidades
const MqttMessage = require('../dist/entities/mqtt-message.entity').MqttMessage;
const MqttSubscribedTopic = require('../dist/entities/mqtt-subscribed-topic.entity').MqttSubscribedTopic;
const Luminaria = require('../dist/entities/luminaria.entity').Luminaria;

// Configuración de la base de datos
const AppDataSource = new DataSource({
  type: process.env.DB_TYPE || 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'centinela',
  entities: [MqttMessage, MqttSubscribedTopic, Luminaria],
  synchronize: false,
  logging: false,
});

async function limpiarTopicsProcesadoNoLuminarias() {
  try {
    console.log('🔌 Conectando a la base de datos...');
    await AppDataSource.initialize();
    console.log('✅ Conectado a la base de datos\n');

    const mqttMessageRepository = AppDataSource.getRepository('MqttMessage');
    const mqttSubscribedTopicRepository = AppDataSource.getRepository('MqttSubscribedTopic');
    const luminariaRepository = AppDataSource.getRepository('Luminaria');

    // Función para verificar si un topic es de luminaria
    async function esTopicLuminaria(topic) {
      // Verificar en mqtt_subscribed_topics
      const subscribedTopic = await mqttSubscribedTopicRepository.findOne({
        where: { topic },
      });
      
      if (subscribedTopic && subscribedTopic.categoria === 'luminarias') {
        return true;
      }
      
      // Verificar en tabla luminarias
      const luminaria = await luminariaRepository.findOne({
        where: { topic },
      });
      
      return !!luminaria;
    }

    // Buscar todos los topics que terminan en /procesado
    console.log('🔍 Buscando topics que terminan en /procesado...');
    const topicsProcesado = await mqttMessageRepository
      .createQueryBuilder('message')
      .select('DISTINCT message.topic', 'topic')
      .where('message.topic LIKE :pattern', { pattern: '%/procesado' })
      .getRawMany();

    console.log(`📋 Encontrados ${topicsProcesado.length} topics que terminan en /procesado\n`);

    const topicsAEliminar = [];
    let totalEliminados = 0;

    for (const row of topicsProcesado) {
      const topicProcesado = row.topic;
      const topicBase = topicProcesado.replace('/procesado', '');
      
      console.log(`🔎 Verificando: ${topicProcesado} (base: ${topicBase})`);
      
      const esLuminaria = await esTopicLuminaria(topicBase);
      
      if (!esLuminaria) {
        console.log(`  ❌ No es luminaria, eliminando...`);
        
        const resultado = await mqttMessageRepository
          .createQueryBuilder()
          .delete()
          .where('topic = :topic', { topic: topicProcesado })
          .execute();
        
        const eliminados = resultado.affected || 0;
        totalEliminados += eliminados;
        topicsAEliminar.push(topicProcesado);
        
        console.log(`  ✅ Eliminados ${eliminados} mensajes\n`);
      } else {
        console.log(`  ✅ Es luminaria, manteniendo\n`);
      }
    }

    console.log('\n📊 Resumen:');
    console.log(`  - Topics eliminados: ${topicsAEliminar.length}`);
    console.log(`  - Mensajes eliminados: ${totalEliminados}`);
    
    if (topicsAEliminar.length > 0) {
      console.log('\n📝 Topics eliminados:');
      topicsAEliminar.forEach(topic => console.log(`  - ${topic}`));
    }

    await AppDataSource.destroy();
    console.log('\n✅ Limpieza completada');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Ejecutar limpieza
limpiarTopicsProcesadoNoLuminarias();
