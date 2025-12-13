/**
 * Interfaz para respuestas estándar de la API
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

