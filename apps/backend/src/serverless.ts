import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';

let cached: express.Express | null = null;

/**
 * Nest uygulamasını Express üzerinde kurar. WebSocket YOK → Vercel serverless
 * uyumlu. Hem yerel (main.ts) hem serverless (api/index.js) bunu kullanır.
 * `cached` sayesinde sıcak (warm) invocation'larda yeniden kurulmaz.
 */
export async function createServer(): Promise<express.Express> {
  if (cached) return cached;

  const expressApp = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    logger: ['error', 'warn', 'log'],
  });
  const config = app.get(ConfigService);

  expressApp.set('trust proxy', 1);
  expressApp.disable('x-powered-by');
  expressApp.use(
    '/api',
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const corsRaw = config.get<string>('CORS_ORIGIN', '*');
  const corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length <= 1 ? corsOrigins[0] ?? '*' : corsOrigins,
    credentials: true,
  });

  await app.init();
  cached = expressApp;
  return expressApp;
}
