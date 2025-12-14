/**
 * Script simplificado para crear usuario administrador
 * Ejecutar con: node create-admin-simple.js
 * 
 * Requiere que las variables de entorno estén configuradas
 */

const { Client } = require('pg');

async function createAdmin() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'mqtt_centinela',
  });

  try {
    await client.connect();
    console.log('✅ Conectado a la base de datos');

    // Verificar si ya existe un administrador
    const checkResult = await client.query(
      "SELECT id, username, email FROM users WHERE rol = 'Administrador' LIMIT 1"
    );

    if (checkResult.rows.length > 0) {
      console.log('⚠️  Ya existe un usuario administrador en la base de datos');
      console.log(`   Username: ${checkResult.rows[0].username}`);
      console.log(`   Email: ${checkResult.rows[0].email}`);
      await client.end();
      return;
    }

    // Crear usuario administrador por defecto
    const insertResult = await client.query(
      `INSERT INTO users (nombre, email, username, password, rol, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, username, email, rol`,
      ['Administrador', 'admin@centinela.com', 'admin', 'admin123', 'Administrador']
    );

    console.log('✅ Usuario administrador creado exitosamente');
    console.log('   Username: admin');
    console.log('   Email: admin@centinela.com');
    console.log('   Password: admin123');
    console.log('');
    console.log('⚠️  IMPORTANTE: Cambia la contraseña después del primer inicio de sesión');

    await client.end();
  } catch (error) {
    console.error('❌ Error al crear usuario administrador:', error.message);
    if (error.code === '42P01') {
      console.error('   La tabla "users" no existe. Asegúrate de que la base de datos esté inicializada.');
    }
    process.exit(1);
  }
}

createAdmin();
