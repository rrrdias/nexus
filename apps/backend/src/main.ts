import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';
import { getAllowedCorsOrigins, isOriginAllowed } from './config/app-config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. Security Headers (Helmet)
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    }),
  );

  // 2. High-Performance Gzip Compression
  app.use(compression());

  // 3. Payload size configuration for large bulk datasets
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ limit: '50mb', extended: true }));

  // 4. CORS configuration
  const allowedCorsOrigins = getAllowedCorsOrigins();
  app.enableCors({
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin, allowedCorsOrigins));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-cron-secret',
      'x-request-id',
      'x-correlation-id',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  // 5. Global Validation Pipe with automatic transformation and sanitization
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 6. Graceful Shutdown Hooks for PostgreSQL & MSSQL connection lifecycle
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  logger.log(`CORS allowed origins: ${allowedCorsOrigins.length > 0 ? allowedCorsOrigins.join(', ') : 'server-to-server only'}`);
  logger.log(`Nexus Core Backend initialized on port ${port} (PID: ${process.pid})`);
}
bootstrap();
