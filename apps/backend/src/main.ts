import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Raw body for Stripe webhook signature verification
  app.use(
    '/api/v1/billing/webhook',
    express.raw({ type: 'application/json' }),
    (req: any, _res: any, next: any) => {
      req.rawBody = req.body;
      next();
    },
  );

  // Increase body size limit for large text payloads (character extraction etc.)
  app.use(express.json({ limit: '1mb' }));

  // Security
  app.use(helmet());

  // CORS: support multiple origins (comma-separated) and Vercel preview URLs
  const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (server-to-server, health checks)
      if (!origin) return callback(null, true);
      // Exact match against configured origins
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Allow Vercel preview deployments (*.vercel.app)
      if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
      // Allow workwrite.jp and subdomains
      if (/^https:\/\/(.*\.)?workwrite\.jp$/.test(origin)) return callback(null, true);
      callback(null, false);
    },
    credentials: true,
  });

  // Serve uploaded files (avatars, etc.)
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global filters and interceptors
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new TransformInterceptor(),
  );

  // Swagger/OpenAPI (disabled in production)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Workwrite API')
      .setDescription('Workwrite - REST API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Increase HTTP server timeout for SSE streaming (AI assist)
  const port = process.env.PORT || 3001;
  const server = await app.listen(port);
  server.keepAliveTimeout = 120_000; // 120s
  server.headersTimeout = 125_000;   // slightly above keepAliveTimeout
  (server as any).requestTimeout = 300_000; // 5 min for long SSE streams
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
