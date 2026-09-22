import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import * as path from 'path';
import { AppModule } from './app.module';
import { EnvService } from './config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const env = app.get(EnvService);

  // Prefijo global para todas las rutas
  app.setGlobalPrefix('api');

  // Servir archivos subidos (ej: /api/uploads/avatars/...)
  const uploadsDir = path.join(process.cwd(), 'uploads');
  app.use('/api/uploads', express.static(uploadsDir));

  // Habilitar CORS.
  // CORS_ORIGIN es obligatorio en producción (validado en configuration.ts).
  // En desarrollo, si no está definido, se refleja el origen de la petición
  // en vez de usar '*', que es inválido junto con credentials: true.
  app.enableCors({
    origin: env.corsOrigin
      ? env.corsOrigin.split(',').map((o) => o.trim())
      : true,
    credentials: true,
  });

  // Validación global usando class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  await app.listen(env.port);
  console.log(`🚀 Application is running on: http://localhost:${env.port}/api`);
}

bootstrap().catch((error) => {
  console.error('Error starting the application:', error);
  process.exit(1);
});
