-- Área de agrupación visual para barreras (usado en Otras Barreras)
ALTER TABLE barreras
  ADD COLUMN IF NOT EXISTS area VARCHAR(100) NULL;

COMMENT ON COLUMN barreras.area IS 'Área para agrupación visual de barreras (ej: Patio Norte)';
