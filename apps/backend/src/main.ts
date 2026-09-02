import { config } from 'dotenv';
config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import { json, urlencoded } from 'express';

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
  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server / curl or matching frontend
      if (!origin || origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1') || origin.includes('unievangelica.edu.br')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive default while respecting headers
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-cron-secret', 'Accept'],
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
  logger.log(`Nexus Core Backend initialized on port ${port} (PID: ${process.pid})`);
}
bootstrap();
