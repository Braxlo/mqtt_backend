-- Migración: Agregar columna tipoDispositivo a la tabla barreras
-- Descripción: Permite guardar el tipo de dispositivo de entrada para las barreras (RPI, PLC_S, PLC_N, DWORD)

DO $$
BEGIN
  -- Agregar tipoDispositivo a barreras si no existe
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'barreras'
      AND column_name = 'tipoDispositivo'
  ) THEN
    ALTER TABLE barreras ADD COLUMN "tipoDispositivo" VARCHAR(10) DEFAULT 'PLC_S';
    RAISE NOTICE '✅ Columna tipoDispositivo agregada exitosamente a la tabla barreras';

    -- Inicializar registros existentes con el valor por defecto
    UPDATE barreras SET "tipoDispositivo" = 'PLC_S' WHERE "tipoDispositivo" IS NULL;
  ELSE
    RAISE NOTICE 'ℹ️  La columna tipoDispositivo ya existe en la tabla barreras';
  END IF;
END $$;

