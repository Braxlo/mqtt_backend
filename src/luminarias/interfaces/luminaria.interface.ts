/**
 * Interfaz para la configuración de una luminaria
 */
export interface ConfiguracionLuminaria {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para la luminaria
  orden?: number; // Orden de visualización
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD'; // Tipo de dispositivo de entrada
  tipoBateria?: '24V' | '48V'; // 48V luminarias/DES, 24V ej. Esperanza Sur — define umbrales de alerta
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'; // Página de visualización
  controlHeader?: string; // Cabecera configurable de comandos temporizados (ej: HRTW / HRTX)
  mostrarTarjetaControl?: boolean; // Mostrar/ocultar tarjeta de control horario en dashboard
  controlHoraInicio?: string | null;
  controlHoraFin?: string | null;
  controlUltimaTrama?: string | null;
  controlUltimaEnviadaAt?: string | null; // ISO 8601
}

