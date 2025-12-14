-- Script de inicialización de la base de datos
-- Ejecutar con: psql -U postgres -d mqtt_centinela -f init-database.sql

-- Crear tabla de usuarios si no existe
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  rol VARCHAR(20) NOT NULL CHECK (rol IN ('Administrador', 'Operador')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_rol ON users(rol);

-- Crear tabla de barreras si no existe
CREATE TABLE IF NOT EXISTS barreras (
  id VARCHAR(255) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  topic VARCHAR(255) NOT NULL,
  url_camara VARCHAR(500),
  comando_abrir VARCHAR(255) NOT NULL,
  comando_cerrar VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de escenarios si no existe
CREATE TABLE IF NOT EXISTS escenarios (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  descripcion TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de escenario_topics si no existe
CREATE TABLE IF NOT EXISTS escenario_topics (
  id SERIAL PRIMARY KEY,
  escenario_id INTEGER REFERENCES escenarios(id) ON DELETE CASCADE,
  topic VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de mqtt_config si no existe
CREATE TABLE IF NOT EXISTS mqtt_config (
  id SERIAL PRIMARY KEY,
  broker_url VARCHAR(500) NOT NULL,
  auto_connect BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de mqtt_messages si no existe
CREATE TABLE IF NOT EXISTS mqtt_messages (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mqtt_messages
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_topic ON mqtt_messages(topic);
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_timestamp ON mqtt_messages(timestamp);

-- Crear tabla de mqtt_subscribed_topics si no existe
CREATE TABLE IF NOT EXISTS mqtt_subscribed_topics (
  id SERIAL PRIMARY KEY,
  topic VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear usuario administrador si no existe
INSERT INTO users (nombre, email, username, password, rol, created_at, updated_at)
VALUES (
  'Administrador',
  'admin@centinela.com',
  'admin',
  'admin123',
  'Administrador',
  NOW(),
  NOW()
)
ON CONFLICT (username) DO NOTHING;

-- Verificar tablas creadas
SELECT 'Tablas creadas:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Verificar usuario administrador
SELECT 'Usuario administrador:' as info;
SELECT id, nombre, email, username, rol, created_at 
FROM users 
WHERE rol = 'Administrador';
