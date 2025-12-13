/**
 * Interfaz para usuarios del sistema (gestión)
 */
export interface User {
  id: number;
  nombre: string;
  email: string;
  username: string;
  password: string; // En producción debería estar hasheado
  rol: 'Administrador' | 'Operador';
}

/**
 * Interfaz para usuario sin contraseña (respuestas)
 */
export interface UserResponse {
  id: number;
  nombre: string;
  email: string;
  username: string;
  rol: 'Administrador' | 'Operador';
}

