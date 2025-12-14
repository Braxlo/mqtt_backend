import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

/**
 * Función principal para inicializar la aplicación NestJS
 */
async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Configuración global de CORS
  const corsOrigins = process.env.CORS_ORIGIN 
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : ['http://localhost:3005', 'http://127.0.0.1:3005'];
  
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requests sin origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);
      
      // Permitir si está en la lista de orígenes permitidos
      if (corsOrigins.includes(origin) || corsOrigins.includes('*')) {
        callback(null, true);
      } else {
        // En desarrollo, permitir localhost con cualquier puerto
        if (process.env.NODE_ENV !== 'production' && origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
          callback(null, true);
        } else {
          callback(new Error('No permitido por CORS'));
        }
      }
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
  logger.log(`🌐 CORS habilitado para: ${corsOrigins.join(', ')}`);
}
bootstrap();
