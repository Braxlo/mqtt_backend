/**
 * Constantes de la aplicación
 */
export const APP_CONSTANTS = {
  // Configuración MQTT
  MQTT: {
    DEFAULT_RECONNECT_PERIOD: 5000,
    DEFAULT_CONNECT_TIMEOUT: 30000,
    CLIENT_ID_PREFIX: 'centinela-backend',
  },
  // Configuración JWT
  JWT: {
    DEFAULT_EXPIRES_IN: '24h',
    SECRET_KEY: process.env.JWT_SECRET || 'centinela-secret-key-change-in-production',
  },
  // Configuración WebSocket
  WEBSOCKET: {
    CORS_ORIGIN: '*',
  },
} as const;

