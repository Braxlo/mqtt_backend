/**
 * Interfaz para mensajes MQTT
 */
export interface MqttMessage {
  topic: string;
  message: string;
  timestamp: Date;
}

/**
 * Interfaz para el estado de conexión MQTT
 */
export interface MqttConnectionStatus {
  connected: boolean;
  brokerUrl: string | null;
  subscribedTopics: string[];
}

