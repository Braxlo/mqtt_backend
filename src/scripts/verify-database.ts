import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { MqttMessage } from '../entities/mqtt-message.entity';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function verifyDatabase() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mqtt_centinela',
    entities: [MqttMessage],
    synchronize: false, // No sincronizar en este script
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado a la base de datos\n');

    // Verificar tabla mqtt_messages
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    const table = await queryRunner.getTable('mqtt_messages');
    
    if (!table) {
      console.log('❌ La tabla mqtt_messages no existe');
      console.log('   Ejecuta el script init-database.sql o habilita DB_SYNCHRONIZE=true\n');
      await queryRunner.release();
      await dataSource.destroy();
      return;
    }

    console.log('📋 Verificando columnas de la tabla mqtt_messages:\n');
    
    const columns = table.columns.map(col => ({
      name: col.name,
      type: col.type,
      isNullable: col.isNullable,
    }));

    columns.forEach(col => {
      const nullable = col.isNullable ? '(nullable)' : '(not null)';
      console.log(`   - ${col.name}: ${col.type} ${nullable}`);
    });

    // Verificar columnas nuevas
    const hasUserId = columns.some(c => c.name === 'user_id');
    const hasUsername = columns.some(c => c.name === 'username');

    console.log('\n📊 Estado de las nuevas columnas:');
    
    if (hasUserId) {
      console.log('   ✅ user_id: EXISTE');
    } else {
      console.log('   ❌ user_id: NO EXISTE');
      console.log('      Ejecuta: ALTER TABLE mqtt_messages ADD COLUMN user_id INTEGER;');
    }

    if (hasUsername) {
      console.log('   ✅ username: EXISTE');
    } else {
      console.log('   ❌ username: NO EXISTE');
      console.log('      Ejecuta: ALTER TABLE mqtt_messages ADD COLUMN username VARCHAR(100);');
    }

    if (hasUserId && hasUsername) {
      console.log('\n✅ La tabla mqtt_messages está actualizada correctamente');
    } else {
      console.log('\n⚠️  La tabla necesita actualizarse');
      console.log('   Opciones:');
      console.log('   1. Ejecuta el script init-database.sql');
      console.log('   2. O habilita DB_SYNCHRONIZE=true en .env y reinicia el backend');
    }

    await queryRunner.release();
    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error al verificar la base de datos:', error);
    process.exit(1);
  }
}

verifyDatabase();

