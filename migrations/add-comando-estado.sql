-- Migración: Agregar columna comando_estado a la tabla barreras
-- Fecha: 2024
-- Descripción: Agrega el campo comando_estado para permitir consultar el estado de las barreras

-- Verificar si la columna ya existe antes de agregarla
DO $$ 
BEGIN
  -- Agregar comando_estado a barreras si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'barreras' 
      AND column_name = 'comando_estado'
  ) THEN
    ALTER TABLE barreras ADD COLUMN comando_estado TEXT;
    RAISE NOTICE '✅ Columna comando_estado agregada exitosamente a la tabla barreras';
  ELSE
    RAISE NOTICE 'ℹ️  La columna comando_estado ya existe en la tabla barreras';
  END IF;
END $$;

-- Verificar que la columna fue agregada correctamente
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'barreras'
  AND column_name = 'comando_estado';

-- Mostrar estructura actualizada de la tabla barreras
SELECT 
  'Estructura de la tabla barreras:' as info;
  
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'barreras'
ORDER BY ordinal_position;

