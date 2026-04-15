/**
 * Interfaz para la configuración de una barrera
 */
export interface ConfiguracionBarrera {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para la barrera
  urlCamara: string; // URL de la cámara para visualización
  comandoAbrir: string; // Comando/trama para subir/abrir la barrera
  comandoCerrar: string; // Comando/trama para bajar/cerrar la barrera
  comandoEnclavarArriba?: string; // Comando/trama para enclavar arriba en ON
  comandoEnclavarArribaOff?: string; // Comando/trama para enclavar arriba en OFF
  comandoEstado?: string; // Comando/trama para consultar el estado de la barrera
  funcion?: 'entrada' | 'salida' | 'ambas'; // Función de la barrera: entrada, salida o ambas
  orden?: number; // Orden de visualización
  tipoBateria?: '24V' | '48V'; // Define umbrales de alerta para reporte de energía (precaución/crítico)
  tipoDispositivo?: 'RPI' | 'PLC_S' | 'PLC_N' | 'DWORD'; // Tipo de dispositivo de entrada (energía)
  categoria?: 'chancado' | 'luminarias' | 'barreras' | 'letreros' | 'otras_barreras' | 'otros' | 'prueba' | 'sin_asignar'; // Categoría de la barrera (sin_asignar = no asignada)
}

