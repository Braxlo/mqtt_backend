import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/** Quita barras finales: el header Origin del navegador nunca las trae y evita fallos de CORS. */
function normalizeOrigin(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Función principal para inicializar la aplicación NestJS
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // CORS: CORS_ORIGIN=* → cualquier origen (útil al cambiar de servidor/IP sin redeploy).
  // Lista separada por comas: http://IP:3007,https://dominio.com (con o sin / final, se normaliza).
  const raw = process.env.CORS_ORIGIN?.trim();
  const parts = raw ? raw.split(',').map((o) => o.trim()).filter(Boolean) : [];
  const allowAnyOrigin = parts.includes('*');
  const corsOrigins = allowAnyOrigin
    ? []
    : parts.length > 0
      ? parts.map(normalizeOrigin).filter((o) => o !== '*')
      : [normalizeOrigin('http://localhost:3007'), normalizeOrigin('http://127.0.0.1:3007')];

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, Postman, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowAnyOrigin) {
        return callback(null, true);
      }

      const reqOrigin = normalizeOrigin(origin);
      if (corsOrigins.includes(reqOrigin)) {
        return callback(null, true);
      }

      // Desarrollo: cualquier puerto en localhost / 127.0.0.1
      const isLocalDev =
        process.env.NODE_ENV !== 'production' &&
        (reqOrigin.startsWith('http://localhost:') || reqOrigin.startsWith('http://127.0.0.1:'));

      if (isLocalDev) {
        return callback(null, true);
      }

      return callback(new Error('No permitido por CORS'));
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 horas
  });

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Filtro global de excepciones
  app.useGlobalFilters(new HttpExceptionFilter());

  // Validación global con transformación
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: false,
    }),
  );

  const port = process.env.PORT || 3006;
  const host = process.env.HOST || '0.0.0.0';
  
  await app.listen(port, host);
  
  logger.log(`🚀 Backend corriendo en http://${host === '0.0.0.0' ? 'localhost' : host}:${port}`);
  logger.log(`📡 API disponible en http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/api`);
  logger.log(
    `🌐 CORS: ${allowAnyOrigin ? 'cualquier origen (*)' : corsOrigins.join(', ')}`,
  );
}
bootstrap();
