-- Comando MQTT opcional para el botón «Enclavar arriba» (ej. HRBI3)
ALTER TABLE barreras
  ADD COLUMN IF NOT EXISTS comando_enclavar_arriba TEXT NULL;

COMMENT ON COLUMN barreras.comando_enclavar_arriba IS 'Trama MQTT para enclavar la barrera en posición arriba (opcional)';
