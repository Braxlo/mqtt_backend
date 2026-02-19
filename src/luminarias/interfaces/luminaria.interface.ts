/**
 * Interfaz para la configuración de una luminaria
 */
export interface ConfiguracionLuminaria {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para la luminaria
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N'; // Tipo de dispositivo de entrada
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'; // Página de visualización
}

