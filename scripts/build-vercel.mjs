// Tek Vercel projesi: hem Nuxt frontend'i hem NestJS backend'i build eder ve
// ikisini tek bir Build Output API çıktısında (.vercel/output) birleştirir.
//  - Frontend → Nuxt (vercel preset) → .vercel/output (static + SSR fonksiyonu)
//  - Backend  → nest build → .vercel/output/functions/api.func (kendi node_modules'ı ile)
//  - /api/*   → api.func'a yönlendirilir (aynı domain → CORS yok)
import { execSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Script nerede çağrılırsa çağrılsın repo kökünden çalış.
process.chdir(join(dirname(fileURLToPath(import.meta.url)), '..'));

const run = (cmd, cwd) => {
  console.log(`\n$ ${cmd}${cwd ? `  (cwd: ${cwd})` : ''}`);
  execSync(cmd, { stdio: 'inherit', cwd, env: process.env });
};

// 1) Frontend build (Nuxt → apps/frontend/.vercel/output)
run('npm --workspace apps/frontend run build');

// 2) Kök .vercel/output'u frontend çıktısından oluştur
rmSync('.vercel/output', { recursive: true, force: true });
mkdirSync('.vercel', { recursive: true });
cpSync('apps/frontend/.vercel/output', '.vercel/output', { recursive: true });
console.log('✓ Frontend output hazırlandı.');

// 3) Backend'i derle ve api.func olarak ekle (hata olursa frontend yine deploy olsun)
try {
  run('npm --workspace apps/backend run build');

  const fn = '.vercel/output/functions/api.func';
  mkdirSync(fn, { recursive: true });
  cpSync('apps/backend/dist', `${fn}/dist`, { recursive: true });
  cpSync('apps/backend/prisma/schema.prisma', `${fn}/schema.prisma`);

  // Sadece runtime bağımlılıkları içeren sade package.json (script yok → postinstall tetiklenmez)
  const bpkg = JSON.parse(readFileSync('apps/backend/package.json', 'utf8'));
  writeFileSync(
    `${fn}/package.json`,
    JSON.stringify({ name: 'rebirth-api-func', private: true, dependencies: bpkg.dependencies }, null, 2),
  );

  // Serverless handler
  writeFileSync(
    `${fn}/index.js`,
    [
      "const { createServer } = require('./dist/serverless');",
      'let appPromise;',
      'module.exports = async (req, res) => {',
      '  if (!appPromise) appPromise = createServer();',
      '  const app = await appPromise;',
      '  return app(req, res);',
      '};',
      '',
    ].join('\n'),
  );

  // Vercel fonksiyon yapılandırması
  writeFileSync(
    `${fn}/.vc-config.json`,
    JSON.stringify({ runtime: 'nodejs20.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: true }, null, 2),
  );

  // Fonksiyonun kendi node_modules'ı (sadece runtime bağımlılıkları)
  run('npm install --omit=dev --no-audit --no-fund --workspaces=false', fn);
  // Üretilmiş Prisma client'ı ana build'den kopyala. (npx prisma generate fonksiyon
  // dizininde @prisma/client'ı çözemiyor; Neon adapter ile engine binary gerekmediği
  // için üretilmiş JS client'ı kopyalamak yeterli.)
  cpSync('node_modules/.prisma', `${fn}/node_modules/.prisma`, { recursive: true, force: true });
  cpSync('node_modules/@prisma/client', `${fn}/node_modules/@prisma/client`, { recursive: true, force: true });

  // Routing: /api/* → api fonksiyonu (en başa ekle ki frontend route'larından önce yakalansın)
  const cfgPath = '.vercel/output/config.json';
  const cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
  cfg.routes = cfg.routes || [];
  cfg.routes.unshift({ src: '^/api(?:/.*)?$', dest: '/api' });
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));

  console.log('✓ Backend api.func eklendi ve /api route ayarlandı.');
} catch (e) {
  console.error('!! Backend birleştirme HATASI (frontend yine de deploy olacak):', e?.message ?? e);
}
