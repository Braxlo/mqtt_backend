/**
 * Interfaz para la configuración de un letrero
 */
export interface ConfiguracionLetrero {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para el letrero
  orden?: number;
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD'; // Tipo de dispositivo de entrada
  tipoBateria?: '24V' | '48V'; // 48V ej. DES, 24V ej. Esperanza Sur — define umbrales de alerta
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'; // Página de visualización
  urlCamara?: string; // URL para vista de cámara en página Control
  comandoEncender?: string; // Trama MQTT para encendido
  comandoDuracionTemplate?: string; // Plantilla MQTT para segundos, admite {segundos}
  duracionDefaultSegundos?: number; // Segundos por defecto para encendido
  mostrarEnControl?: boolean; // Mostrar tarjeta en página Control
  mostrarCamara?: boolean; // Mostrar bloque de cámara en página Control
  mostrarBotonEncender?: boolean; // Mostrar botón de encendido en página Control
  mostrarControlSegundos?: boolean; // Mostrar control de segundos en página Control
}
