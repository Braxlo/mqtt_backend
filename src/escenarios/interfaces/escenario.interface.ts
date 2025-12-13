/**
 * Interfaz para botones de escenario
 */
export interface BotonEscenario {
  id: string;
  nombre: string;
  topics1: string[]; // Primer grupo de topics
  mensaje1: string; // Mensaje para el primer grupo de topics
  topics2: string[]; // Segundo grupo de topics
  mensaje2: string; // Mensaje para el segundo grupo de topics
  color?: string; // Color del botón (opcional)
}

