import { ApiResponse } from '../interfaces/api-response.interface';

/**
 * Utilidad para crear respuestas estándar de la API
 */
export class ResponseUtil {
  static success<T>(data?: T, message: string = 'Operación exitosa'): ApiResponse<T> {
    return {
      success: true,
      message,
      data,
    };
  }

  static error(message: string, error?: string): ApiResponse {
    return {
      success: false,
      message,
      error,
    };
  }
}

