-- Migración: Agregar columnas username y password a la tabla mqtt_config
-- Fecha: 2026-01-28
-- Descripción: Agrega autenticación básica (Basic Auth) para la conexión al broker MQTT

-- Verificar si las columnas ya existen antes de agregarlas
DO $$ 
BEGIN
  -- Agregar username a mqtt_config si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'mqtt_config' 
      AND column_name = 'username'
  ) THEN
    ALTER TABLE mqtt_config ADD COLUMN username VARCHAR(255) NULL;
    RAISE NOTICE '✅ Columna username agregada exitosamente a la tabla mqtt_config';
  ELSE
    RAISE NOTICE 'ℹ️  La columna username ya existe en la tabla mqtt_config';
  END IF;

  -- Agregar password a mqtt_config si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'mqtt_config' 
      AND column_name = 'password'
  ) THEN
    ALTER TABLE mqtt_config ADD COLUMN password VARCHAR(255) NULL;
    RAISE NOTICE '✅ Columna password agregada exitosamente a la tabla mqtt_config';
  ELSE
    RAISE NOTICE 'ℹ️  La columna password ya existe en la tabla mqtt_config';
  END IF;
END $$;

-- Verificar que las columnas fueron agregadas correctamente
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'mqtt_config'
  AND column_name IN ('username', 'password')
ORDER BY column_name;

-- Mostrar estructura actualizada de la tabla mqtt_config
SELECT 
  'Estructura de la tabla mqtt_config:' as info;
  
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'mqtt_config'
ORDER BY ordinal_position;
