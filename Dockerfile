# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig*.json ./
COPY nest-cli.json ./

# Instalar dependencias
RUN npm ci --no-audit --no-fund

# Copiar código fuente
COPY . .

# Compilar la aplicación
RUN npm run build

# Etapa 2: Producción
FROM node:20-alpine AS production

WORKDIR /app

# Crear usuario no root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production --no-audit --no-fund && npm cache clean --force

# Copiar código compilado desde la etapa de build
COPY --from=builder /app/dist ./dist

# Cambiar propietario de los archivos
RUN chown -R nestjs:nodejs /app

# Cambiar a usuario no root
USER nestjs

# Exponer el puerto
EXPOSE 3006

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3006
ENV HOST=0.0.0.0

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3006/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Comando para iniciar la aplicación
CMD ["node", "dist/main.js"]
