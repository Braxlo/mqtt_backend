-- Trama MQTT para apagar enclavado arriba (OFF), distinta de ON
ALTER TABLE barreras
  ADD COLUMN IF NOT EXISTS comando_enclavar_arriba_off TEXT NULL;

COMMENT ON COLUMN barreras.comando_enclavar_arriba_off IS 'Trama MQTT para ENCLAVADO ARRIBA OFF';
