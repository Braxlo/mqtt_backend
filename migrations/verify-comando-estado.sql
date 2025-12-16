-- Script de verificación: Verificar que comando_estado existe en barreras
-- Ejecutar con: psql -U postgres -d mqtt_centinela -f migrations/verify-comando-estado.sql

SELECT 'Verificando columna comando_estado en tabla barreras...' as info;

-- Verificar si la columna existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
        AND table_name = 'barreras' 
        AND column_name = 'comando_estado'
    ) THEN '✅ La columna comando_estado EXISTE en la tabla barreras'
    ELSE '❌ La columna comando_estado NO EXISTE en la tabla barreras'
  END as resultado;

-- Mostrar detalles de la columna si existe
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'barreras'
  AND column_name = 'comando_estado';

-- Mostrar estructura completa de la tabla barreras
SELECT 
  'Estructura completa de la tabla barreras:' as info;

SELECT 
  column_name as "Columna",
  data_type as "Tipo",
  character_maximum_length as "Longitud",
  is_nullable as "Nullable",
  column_default as "Valor por defecto"
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'barreras'
ORDER BY ordinal_position;

-- Contar barreras existentes
SELECT 
  'Barreras en la base de datos:' as info,
  COUNT(*) as total_barreras
FROM barreras;

