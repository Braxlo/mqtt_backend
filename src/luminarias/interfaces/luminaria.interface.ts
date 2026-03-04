/**
 * Interfaz para la configuración de una luminaria
 */
export interface ConfiguracionLuminaria {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para la luminaria
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD'; // Tipo de dispositivo de entrada
  tipoBateria?: '24V' | '48V'; // 48V luminarias/DES, 24V ej. Esperanza Sur — define umbrales de alerta
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'; // Página de visualización
}

