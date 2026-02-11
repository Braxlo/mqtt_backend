import { DataSource } from 'typeorm';
import { User } from '../entities/user.entity';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Script para crear el usuario "mantención"
 * Ejecutar con: npm run create-mantencion
 */
async function createMantencionUser() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mqtt_centinela',
    entities: [User],
    synchronize: false,
  });

  try {
    await dataSource.initialize();
    console.log('✅ Conexión a la base de datos establecida');

    const userRepository = dataSource.getRepository(User);

    // Verificar si el usuario ya existe
    const existingUser = await userRepository.findOne({
      where: { username: 'mantencion' },
    });

    if (existingUser) {
      console.log('⚠️  El usuario "mantencion" ya existe');
      console.log(`   ID: ${existingUser.id}`);
      console.log(`   Nombre: ${existingUser.nombre}`);
      console.log(`   Email: ${existingUser.email}`);
      console.log(`   Rol: ${existingUser.rol}`);
      await dataSource.destroy();
      return;
    }

    // Crear usuario mantención
    const mantencionUser = userRepository.create({
      nombre: 'Mantención',
      email: 'mantencion@centinela.com',
      username: 'mantencion',
      password: 'mantencion123', // ⚠️ En producción, esto debería estar hasheado
      rol: 'Operador',
    });

    const savedUser = await userRepository.save(mantencionUser);
    console.log('✅ Usuario "mantencion" creado exitosamente');
    console.log(`   ID: ${savedUser.id}`);
    console.log(`   Username: ${savedUser.username}`);
    console.log(`   Email: ${savedUser.email}`);
    console.log(`   Password: mantencion123`);
    console.log(`   Rol: ${savedUser.rol}`);
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Error al crear usuario mantención:', error);
    await dataSource.destroy();
    process.exit(1);
  }
}

// Ejecutar el script
createMantencionUser();
