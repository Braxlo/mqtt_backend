# Guía de Deploy con Dockploy

## Configuración para el servidor 192.168.2.185

### Requisitos previos

1. **Docker y Docker Compose instalados** en el servidor
2. **PostgreSQL** corriendo (puede ser en otro contenedor o servidor externo)
3. **Variables de entorno** configuradas

### Pasos para el deploy

#### 1. Preparar el archivo .env

Crea un archivo `.env` en el directorio `backend/` con las siguientes variables:

```env
# Base de datos
DB_HOST=192.168.2.185  # o la IP de tu servidor PostgreSQL
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=tu_password_seguro
DB_NAME=mqtt_centinela
DB_SYNCHRONIZE=false
DB_LOGGING=false

# JWT
JWT_SECRET=tu_secret_key_muy_segura_y_larga
JWT_EXPIRES_IN=24h

# CORS - Ajustar según tu frontend
CORS_ORIGIN=http://192.168.2.185:3005

# Puerto y Host
PORT=3006
HOST=0.0.0.0
NODE_ENV=production
```

#### 2. Usando Dockploy

##### Opción A: Deploy con Dockerfile directamente

1. En Dockploy, selecciona el repositorio o carpeta del backend
2. Configura el build:
   - **Dockerfile path**: `backend/Dockerfile`
   - **Context**: `backend/`
3. Configura las variables de entorno en Dockploy
4. Configura el puerto: `3006:3006`
5. Deploy

##### Opción B: Deploy con docker-compose

1. En Dockploy, selecciona usar docker-compose
2. Asegúrate de que el archivo `docker-compose.yml` esté en el directorio correcto
3. Configura las variables de entorno
4. Deploy

#### 3. Deploy manual (alternativa)

Si prefieres hacerlo manualmente desde el servidor:

```bash
# 1. Conectarse al servidor
ssh usuario@192.168.2.185

# 2. Clonar o copiar el código
cd /ruta/donde/quieres/el/proyecto
git clone <tu-repo> # o copiar los archivos

# 3. Ir al directorio backend
cd Centinela/backend

# 4. Crear el archivo .env con las variables necesarias
nano .env

# 5. Construir la imagen
docker build -t centinela-backend:latest .

# 6. Ejecutar el contenedor
docker run -d \
  --name centinela-backend \
  --restart unless-stopped \
  -p 3006:3006 \
  --env-file .env \
  centinela-backend:latest

# O usar docker-compose
docker-compose up -d
```

### Verificación

Una vez desplegado, verifica que el servicio esté corriendo:

```bash
# Ver logs
docker logs centinela-backend

# Verificar salud
curl http://192.168.2.185:3006/api/health

# Ver contenedores corriendo
docker ps
```

### Configuración de red

Si el frontend está en el mismo servidor o en otro, asegúrate de:

1. **CORS configurado correctamente**: La variable `CORS_ORIGIN` debe incluir la URL del frontend
2. **Firewall**: Asegúrate de que el puerto 3006 esté abierto si necesitas acceso externo
3. **Base de datos**: Si PostgreSQL está en otro servidor, verifica la conectividad de red

### Troubleshooting

#### El contenedor no inicia
- Revisa los logs: `docker logs centinela-backend`
- Verifica las variables de entorno
- Asegúrate de que la base de datos esté accesible

#### Error de conexión a la base de datos
- Verifica que `DB_HOST` sea correcto
- Asegúrate de que PostgreSQL acepte conexiones desde el contenedor
- Revisa las credenciales

#### Error de CORS
- Verifica que `CORS_ORIGIN` incluya la URL exacta del frontend
- Si el frontend está en otro puerto, inclúyelo en la variable

### Actualización

Para actualizar la aplicación:

```bash
# Detener el contenedor
docker stop centinela-backend

# Reconstruir la imagen
docker build -t centinela-backend:latest .

# Iniciar nuevamente
docker start centinela-backend

# O con docker-compose
docker-compose up -d --build
```
