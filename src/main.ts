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
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
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

  const port = process.env.PORT || 3001;
  await app.listen(port);
  
  logger.log(`🚀 Backend corriendo en http://localhost:${port}`);
  logger.log(`📡 API disponible en http://localhost:${port}/api`);
}
bootstrap();
