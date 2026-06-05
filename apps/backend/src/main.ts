import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const expressApp = app.getHttpAdapter().getInstance();
  // Throttler IP'leri reverse-proxy arkasında doğru görsün.
  expressApp.set('trust proxy', 1);
  // X-Powered-By: Express imzasını gizle.
  expressApp.disable('x-powered-by');

  // Helmet sadece /api altına — Socket.IO engine.io path'leri (/socket.io/*)
  // bağımsız transport'ta kalsın.
  expressApp.use(
    '/api',
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const corsRaw = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const corsOrigins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
  app.enableCors({
    origin: corsOrigins.length > 1 ? corsOrigins : corsOrigins[0],
    credentials: true,
  });

  const port = config.get<number>('PORT', 3001);
  // Render/Railway gibi platformlar 0.0.0.0'a bind edilmeyi bekler.
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Backend hazır: port ${port} (/api)`);
}
bootstrap();
