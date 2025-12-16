# Esquema de Base de Datos - Sistema Centinela

## Resumen de Tablas

Este documento describe todas las tablas que se crean automáticamente en la base de datos PostgreSQL `mqtt_centinela`.

---

## 1. Gestión de Usuarios

### Tabla: `users`
- **Propósito**: Almacenar usuarios del sistema
- **Campos**:
  - `id` (PK, auto-increment): ID único del usuario
  - `nombre` (varchar 100): Nombre completo
  - `email` (varchar 255, único, indexado): Email del usuario
  - `username` (varchar 50, único, indexado): Nombre de usuario
  - `password` (varchar 255): Contraseña (sin hash por ahora)
  - `rol` (varchar 20, indexado): Rol del usuario ('Administrador' o 'Operador')
  - `created_at` (timestamp): Fecha de creación
  - `updated_at` (timestamp): Fecha de última actualización

---

## 2. Gestión MQTT

### Tabla: `mqtt_messages`
- **Propósito**: Historial de mensajes MQTT recibidos
- **Campos**:
  - `id` (PK, auto-increment): ID único del mensaje
  - `topic` (varchar 500, indexado): Topic MQTT
  - `message` (text): Contenido del mensaje
  - `timestamp` (timestamp, indexado): Fecha y hora del mensaje
  - `created_at` (timestamp): Fecha de creación del registro

### Tabla: `mqtt_subscribed_topics`
- **Propósito**: Topics MQTT suscritos (persistencia)
- **Campos**:
  - `id` (PK, auto-increment): ID único
  - `topic` (varchar 500, único, indexado): Nombre del topic
  - `active` (boolean, default true): Si el topic está activo
  - `created_at` (timestamp): Fecha de creación
  - `updated_at` (timestamp): Fecha de última actualización

### Tabla: `mqtt_config`
- **Propósito**: Configuración del broker MQTT (auto-reconexión)
- **Campos**:
  - `id` (PK, varchar 50, default 'default'): ID de configuración (solo una)
  - `broker_url` (varchar 500, nullable): URL del broker MQTT
  - `auto_connect` (boolean, default false): Si debe conectar automáticamente al iniciar
  - `created_at` (timestamp): Fecha de creación
  - `updated_at` (timestamp): Fecha de última actualización

---

## 3. Configuración de Barreras

### Tabla: `barreras`
- **Propósito**: Configuración de barreras del sistema
- **Campos**:
  - `id` (PK, varchar 255): ID único de la barrera
  - `nombre` (varchar 255, indexado): Nombre de la barrera
  - `topic` (varchar 500, indexado): Topic MQTT para la barrera
  - `url_camara` (text): URL de la cámara para visualización
  - `comando_abrir` (text): Comando/trama para abrir la barrera
  - `comando_cerrar` (text): Comando/trama para cerrar la barrera
  - `comando_estado` (text, nullable): Comando/trama para consultar el estado de la barrera
  - `created_at` (timestamp): Fecha de creación
  - `updated_at` (timestamp): Fecha de última actualización

---

## 4. Configuración por Escenario

### Tabla: `escenarios`
- **Propósito**: Escenarios/botones de control
- **Campos**:
  - `id` (PK, varchar 255): ID único del escenario
  - `nombre` (varchar 255): Nombre del escenario
  - `color` (varchar 50, nullable): Color del botón
  - `created_at` (timestamp): Fecha de creación
  - `updated_at` (timestamp): Fecha de última actualización

### Tabla: `escenario_topics`
- **Propósito**: Topics asociados a cada escenario (relación)
- **Campos**:
  - `id` (PK, auto-increment): ID único
  - `escenario_id` (varchar 255, indexado, FK): ID del escenario
  - `grupo` (integer, indexado): Grupo del topic (1 o 2)
  - `topic` (varchar 500, indexado): Nombre del topic MQTT
  - `mensaje` (text, nullable): Mensaje a enviar al topic
  - `created_at` (timestamp): Fecha de creación
- **Relaciones**:
  - Muchos a uno con `escenarios` (CASCADE DELETE)
  - Restricción única: `escenario_id + grupo + topic`

---

## Resumen de Tablas

| # | Tabla | Propósito | Estado |
|---|-------|-----------|--------|
| 1 | `users` | Gestión de usuarios | ✅ Creada |
| 2 | `mqtt_messages` | Historial de mensajes MQTT | ✅ Creada |
| 3 | `mqtt_subscribed_topics` | Topics MQTT suscritos | ✅ Creada |
| 4 | `mqtt_config` | Configuración broker MQTT | ✅ Creada |
| 5 | `barreras` | Configuración de barreras | ✅ Creada |
| 6 | `escenarios` | Configuración de escenarios | ✅ Creada |
| 7 | `escenario_topics` | Topics de escenarios | ✅ Creada |

**Total: 7 tablas**

---

## Notas Importantes

1. **Sincronización automática**: Con `DB_SYNCHRONIZE=true`, TypeORM crea/actualiza las tablas automáticamente al iniciar la aplicación.

2. **Índices**: Todas las tablas tienen índices en campos clave para mejorar el rendimiento.

3. **Relaciones**: 
   - `escenario_topics` tiene relación CASCADE con `escenarios` (si se elimina un escenario, se eliminan sus topics).

4. **Unicidad**:
   - `users.email` y `users.username` son únicos
   - `mqtt_subscribed_topics.topic` es único
   - `escenario_topics` tiene restricción única en `(escenario_id, grupo, topic)`

