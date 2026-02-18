/**
 * Interfaz para la configuración de un punto de referencia HKN
 */
export interface ConfiguracionPuntoReferencia {
  id: number;
  nombre: string;
  codigo: string; // GC, GN, GS, GH, etc.
  latitud: number;
  longitud: number;
  descripcion?: string | null;
  tipo?: string | null;
}
