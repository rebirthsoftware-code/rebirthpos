// Build/deploy sırasında veritabanını hazırlar.
// "endam" (endamsince) projesindeki scripts/db-prepare.mjs ile aynı mantık:
//   1) DATABASE_URL yoksa sessizce çık → build kırılmaz
//   2) prisma db push ile şemayı Neon Postgres'e uygular (migration geçmişi tutmadan)
//   3) seed ile demo firma/şube/kullanıcıları ekler (idempotent upsert)
// Tüm adımlar non-blocking: hata loglanır ama build'i düşürmez.
import { execSync } from 'node:child_process';

const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;

if (!url) {
  console.log('[db-prepare] DATABASE_URL tanımlı değil — adım atlanıyor (build devam ediyor).');
  process.exit(0);
}

function run(cmd) {
  console.log(`[db-prepare] $ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: process.env });
}

try {
  // Şemayı doğrudan veritabanına uygular. --accept-data-loss CI'da
  // interaktif takılmayı önler. (Gerçek üretim verisinde dikkat — bkz. DEPLOYMENT.md)
  run('npx prisma db push --skip-generate --accept-data-loss');
} catch (err) {
  console.error('[db-prepare] prisma db push başarısız:', err?.message ?? err);
}

try {
  // Demo veri: admin@rebirth.com / admin123. upsert olduğu için tekrar çalışması zararsız.
  run('npm run seed');
} catch (err) {
  console.error('[db-prepare] seed başarısız:', err?.message ?? err);
}

console.log('[db-prepare] tamamlandı.');
