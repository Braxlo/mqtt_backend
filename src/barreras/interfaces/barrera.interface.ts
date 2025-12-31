/**
 * Interfaz para la configuración de una barrera
 */
export interface ConfiguracionBarrera {
  id: string;
  nombre: string;
  topic: string; // Topic MQTT para la barrera
  urlCamara: string; // URL de la cámara para visualización
  comandoAbrir: string; // Comando/trama para abrir la barrera
  comandoCerrar: string; // Comando/trama para cerrar la barrera
  comandoEstado?: string; // Comando/trama para consultar el estado de la barrera
  funcion?: 'entrada' | 'salida' | 'ambas'; // Función de la barrera: entrada, salida o ambas
}

