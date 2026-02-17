/**
 * Interfaz para la configuración de un letrero
 */
export interface ConfiguracionLetrero {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para el letrero
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N'; // Tipo de dispositivo de entrada
}
