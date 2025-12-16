# Migraciones de Base de Datos

Este directorio contiene scripts SQL para migrar la base de datos.

## Migración: Agregar comando_estado a barreras

### Descripción
Agrega la columna `comando_estado` a la tabla `barreras` para permitir consultar el estado de las barreras mediante MQTT.

### Opción 1: Ejecutar manualmente con psql

```bash
# Conectarse a PostgreSQL y ejecutar el script
psql -U postgres -d mqtt_centinela -f migrations/add-comando-estado.sql

# O desde el directorio backend:
cd backend
psql -U postgres -d mqtt_centinela -f migrations/add-comando-estado.sql
```

### Opción 2: Ejecutar desde psql interactivo

```bash
# Conectarse a PostgreSQL
psql -U postgres -d mqtt_centinela

# Dentro de psql, ejecutar:
\i migrations/add-comando-estado.sql
```

### Opción 3: Usar TypeORM Synchronize (Automático)

Si tienes `DB_SYNCHRONIZE=true` en tu archivo `.env`, TypeORM actualizará automáticamente la tabla al iniciar el backend:

```env
DB_SYNCHRONIZE=true
```

Luego simplemente reinicia el backend y TypeORM agregará la columna automáticamente.

### Opción 4: Ejecutar el script init-database.sql completo

El script `init-database.sql` ya incluye la migración para `comando_estado`. Puedes ejecutarlo completo:

```bash
psql -U postgres -d mqtt_centinela -f init-database.sql
```

Este script es seguro de ejecutar múltiples veces ya que verifica si las columnas existen antes de crearlas.

### Verificar que la migración se aplicó correctamente

```sql
-- Verificar que la columna existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'barreras'
  AND column_name = 'comando_estado';

-- Ver todas las columnas de la tabla barreras
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'barreras'
ORDER BY ordinal_position;
```

### Estructura esperada después de la migración

La tabla `barreras` debería tener las siguientes columnas:

- `id` (VARCHAR)
- `nombre` (VARCHAR)
- `topic` (VARCHAR)
- `url_camara` (VARCHAR)
- `comando_abrir` (VARCHAR)
- `comando_cerrar` (VARCHAR)
- `comando_estado` (TEXT) ← **NUEVA COLUMNA**
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Notas

- La columna `comando_estado` es **opcional** (nullable), por lo que las barreras existentes no se verán afectadas
- El script es **idempotente**: puedes ejecutarlo múltiples veces sin problemas
- Si la columna ya existe, el script simplemente informará que ya está presente

