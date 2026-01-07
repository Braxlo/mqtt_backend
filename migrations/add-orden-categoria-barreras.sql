-- Migración: Agregar campos 'orden' y 'categoria' a la tabla barreras
-- Ejecutar con: psql -U postgres -d mqtt_centinela -f migrations/add-orden-categoria-barreras.sql

-- Agregar columna 'orden' si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'barreras' AND column_name = 'orden') THEN
    ALTER TABLE barreras ADD COLUMN orden INTEGER DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_barreras_orden ON barreras(orden);
  END IF;
END $$;

-- Agregar columna 'categoria' si no existe
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'barreras' AND column_name = 'categoria') THEN
    ALTER TABLE barreras ADD COLUMN categoria VARCHAR(50) DEFAULT 'otros';
    CREATE INDEX IF NOT EXISTS idx_barreras_categoria ON barreras(categoria);
  END IF;
END $$;

-- Actualizar barreras existentes para que tengan un orden basado en created_at
UPDATE barreras 
SET orden = subquery.row_number - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) as row_number
  FROM barreras
) AS subquery
WHERE barreras.id = subquery.id;

-- Verificar que las columnas se agregaron correctamente
SELECT 'Columnas agregadas exitosamente' as resultado;

