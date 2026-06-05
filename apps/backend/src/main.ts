import { createServer } from './serverless';

// Yerel geliştirme girişi. Üretimde (Vercel) api/index.js → createServer kullanılır.
async function bootstrap() {
  const app = await createServer();
  const port = Number(process.env.PORT) || 3001;
  // Render/Railway/yerel: 0.0.0.0'a bind.
  app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Backend hazır: port ${port} (/api)`);
  });
}
bootstrap();
