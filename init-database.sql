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
  comando_estado TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla de luminarias si no existe
CREATE TABLE IF NOT EXISTS luminarias (
  id VARCHAR(255) PRIMARY KEY,
  nombre VARCHAR(255) NOT NULL,
  topic VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para luminarias
CREATE INDEX IF NOT EXISTS idx_luminarias_nombre ON luminarias(nombre);
CREATE INDEX IF NOT EXISTS idx_luminarias_topic ON luminarias(topic);

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
  topic VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_id INTEGER,
  username VARCHAR(100)
);

-- Índices para mqtt_messages
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_topic ON mqtt_messages(topic);
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_timestamp ON mqtt_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_mqtt_messages_user_id ON mqtt_messages(user_id);

-- Agregar columnas si la tabla ya existe (para actualizaciones)
DO $$ 
BEGIN
  -- Agregar user_id si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mqtt_messages' AND column_name = 'user_id') THEN
    ALTER TABLE mqtt_messages ADD COLUMN user_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_mqtt_messages_user_id ON mqtt_messages(user_id);
  END IF;
  
  -- Agregar username si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mqtt_messages' AND column_name = 'username') THEN
    ALTER TABLE mqtt_messages ADD COLUMN username VARCHAR(100);
  END IF;
  
  -- Actualizar topic a VARCHAR(500) si es necesario
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name = 'mqtt_messages' AND column_name = 'topic' 
             AND character_maximum_length < 500) THEN
    ALTER TABLE mqtt_messages ALTER COLUMN topic TYPE VARCHAR(500);
  END IF;
  
  -- Agregar created_at si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'mqtt_messages' AND column_name = 'created_at') THEN
    ALTER TABLE mqtt_messages ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
  END IF;
  
  -- Agregar comando_estado a barreras si no existe
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'barreras' AND column_name = 'comando_estado') THEN
    ALTER TABLE barreras ADD COLUMN comando_estado TEXT;
  END IF;
END $$;

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
