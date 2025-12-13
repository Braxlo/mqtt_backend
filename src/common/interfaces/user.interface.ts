/**
 * Interfaz para usuarios del sistema
 */
export interface User {
  id: number;
  username: string;
  role: 'admin' | 'operador';
}

/**
 * Interfaz para el payload del JWT
 */
export interface JwtPayload {
  username: string;
  sub: number;
  role: string;
}

