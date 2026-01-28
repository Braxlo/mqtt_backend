-- Migración: Agregar columna tipoDispositivo a la tabla luminarias
-- Fecha: 2026-01-28
-- Descripción: Agrega el campo tipoDispositivo para especificar el tipo de dispositivo de entrada (RPI, PLC_S, PLC_N)

-- Verificar si la columna ya existe antes de agregarla
DO $$ 
BEGIN
  -- Agregar tipoDispositivo a luminarias si no existe
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'luminarias' 
      AND column_name = 'tipoDispositivo'
  ) THEN
    ALTER TABLE luminarias ADD COLUMN "tipoDispositivo" VARCHAR(10) DEFAULT 'PLC_S';
    RAISE NOTICE '✅ Columna tipoDispositivo agregada exitosamente a la tabla luminarias';
    
    -- Actualizar registros existentes para que tengan el valor por defecto
    UPDATE luminarias SET "tipoDispositivo" = 'PLC_S' WHERE "tipoDispositivo" IS NULL;
    
  ELSE
    RAISE NOTICE 'ℹ️  La columna tipoDispositivo ya existe en la tabla luminarias';
  END IF;
END $$;

-- Verificar que la columna fue agregada correctamente
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'luminarias'
  AND column_name = 'tipoDispositivo';

-- Mostrar estructura actualizada de la tabla luminarias
SELECT 
  'Estructura de la tabla luminarias:' as info;
  
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'luminarias'
ORDER BY ordinal_position;
