# Crear Usuario Administrador

## Problema

Si recibes un error 401 al intentar hacer login, probablemente no hay usuarios en la base de datos.

## Solución: Crear Usuario Administrador

### Opción 1: Desde el Contenedor Docker (Recomendado)

1. **Conectarse al contenedor del backend:**

```bash
sudo docker exec -it mqtt-backend-0pjy8o.1.rkhnck3manyn8psblk3564cv5 bash
```

O si el nombre es diferente, encuentra el contenedor:

```bash
sudo docker ps | grep backend
sudo docker exec -it <CONTAINER_ID> sh
```

2. **Dentro del contenedor, ejecuta el script:**

```bash
# Si tienes acceso a npm/node
npm run create-admin

# O directamente con node
node dist/scripts/create-admin.js
```

**Nota:** El script necesita estar compilado. Si no está, necesitas ejecutarlo de otra manera.

### Opción 2: Ejecutar Script Compilado

Si el script ya está compilado en `dist/scripts/create-admin.js`:

```bash
# Desde fuera del contenedor
sudo docker exec mqtt-backend-0pjy8o.1.rkhnck3manyn8psblk3564cv5 node dist/scripts/create-admin.js
```

### Opción 3: Crear Usuario Directamente en la Base de Datos

Si no puedes ejecutar el script, puedes crear el usuario directamente en PostgreSQL:

```bash
# Conectarse a PostgreSQL
sudo docker exec -it mqtt-centinela-rainzb.1.lwb00tzqko6pyprny0z3gd9a4 psql -U postgres -d mqtt_centinela
```

Dentro de PostgreSQL:

```sql
-- Verificar si hay usuarios
SELECT id, nombre, email, username, rol FROM users;

-- Crear usuario administrador (si no existe)
INSERT INTO users (nombre, email, username, password, rol, created_at, updated_at)
VALUES (
  'Administrador',
  'admin@centinela.com',
  'admin',
  'admin123',
  'Administrador',
  NOW(),
  NOW()
);

-- Verificar que se creó
SELECT id, nombre, email, username, rol FROM users;
```

### Opción 4: Usar la API (si tienes acceso)

Si el backend tiene un endpoint para crear usuarios (y está configurado para permitir creación sin autenticación), puedes usar:

```bash
curl -X POST http://192.168.2.185:3006/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Administrador",
    "email": "admin@centinela.com",
    "username": "admin",
    "password": "admin123",
    "rol": "Administrador"
  }'
```

## Credenciales por Defecto

Después de crear el usuario administrador, puedes iniciar sesión con:

- **Username:** `admin`
- **Password:** `admin123`
- **Email:** `admin@centinela.com`

⚠️ **IMPORTANTE:** Cambia la contraseña después del primer inicio de sesión.

## Verificar Usuarios Existentes

Para verificar si ya hay usuarios en la base de datos:

```bash
# Conectarse a PostgreSQL
sudo docker exec -it mqtt-centinela-rainzb.1.lwb00tzqko6pyprny0z3gd9a4 psql -U postgres -d mqtt_centinela

# Ejecutar query
SELECT id, nombre, email, username, rol FROM users;
```

## Troubleshooting

### El script no se encuentra

Si el script no está compilado, necesitas:

1. **Compilar el proyecto:**
   ```bash
   # Desde el directorio backend local
   npm run build
   ```

2. **O ejecutar el script TypeScript directamente** (requiere ts-node en el contenedor):
   ```bash
   sudo docker exec mqtt-backend-0pjy8o.1.rkhnck3manyn8psblk3564cv5 npx ts-node src/scripts/create-admin.ts
   ```

### Error de conexión a la base de datos

Verifica que las variables de entorno estén correctas:

```bash
sudo docker exec mqtt-backend-0pjy8o.1.rkhnck3manyn8psblk3564cv5 env | grep DB_
```

Deberías ver:
- `DB_HOST=mqtt-centinela-rainzb` (o la IP/hostname correcto)
- `DB_PORT=5432`
- `DB_USERNAME=postgres`
- `DB_PASSWORD=HKNing01`
- `DB_NAME=mqtt_centinela`

## Nota de Seguridad

⚠️ **Las contraseñas se almacenan en texto plano.** Esto es solo para desarrollo. En producción, deberías:

1. Implementar hash de contraseñas (bcrypt)
2. Cambiar las contraseñas por defecto
3. Usar contraseñas seguras
