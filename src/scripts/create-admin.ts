/**
 * Script para crear el primer usuario administrador
 * Ejecutar con: npx ts-node src/scripts/create-admin.ts
 */

import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function createAdmin() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mqtt_centinela',
    entities: [User],
    synchronize: false, // No usar synchronize en producción
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conectado a la base de datos');

    const userRepository = dataSource.getRepository(User);

    // Verificar si ya existe un administrador
    const existingAdmin = await userRepository.findOne({
      where: { rol: 'Administrador' },
    });

    if (existingAdmin) {
      console.log('⚠️  Ya existe un usuario administrador en la base de datos');
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Email: ${existingAdmin.email}`);
      await dataSource.destroy();
      return;
    }

    // Crear usuario administrador por defecto
    const admin = userRepository.create({
      nombre: 'Administrador',
      email: 'admin@centinela.com',
      username: 'admin',
      password: 'admin123', // En producción, esto debería estar hasheado
      rol: 'Administrador',
    });

    await userRepository.save(admin);
    console.log('✅ Usuario administrador creado exitosamente');
    console.log('   Username: admin');
    console.log('   Email: admin@centinela.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error al crear usuario administrador:', error);
    process.exit(1);
  }
}

createAdmin();

