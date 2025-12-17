/**
 * Interfaz para la configuración de una luminaria
 */
export interface ConfiguracionLuminaria {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para la luminaria
}

