import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Demo veri yükleniyor...');

  const firma = await prisma.firma.upsert({
    where: { id: 'demo-firma' },
    update: {},
    create: {
      id: 'demo-firma',
      ad: 'Rebirth Demo Restoran',
      vergiNo: '1234567890',
      paraBirimi: 'TRY',
    },
  });

  const sube = await prisma.sube.upsert({
    where: { id: 'demo-sube' },
    update: {},
    create: {
      id: 'demo-sube',
      firmaId: firma.id,
      ad: 'Merkez Şube',
      adres: 'Trabzon',
    },
  });

  const sifre = await bcrypt.hash('admin123', 10);

  await prisma.kullanici.upsert({
    where: { eposta: 'admin@rebirth.com' },
    update: {},
    create: {
      eposta: 'admin@rebirth.com',
      sifreHash: sifre,
      adSoyad: 'Süper Admin',
      rol: 'SUPER_ADMIN',
    },
  });

  const subeMuduru = await prisma.kullanici.upsert({
    where: { eposta: 'mudur@rebirth.com' },
    update: {},
    create: {
      eposta: 'mudur@rebirth.com',
      sifreHash: sifre,
      adSoyad: 'Şube Müdürü',
      rol: 'SUBE_MUDURU',
    },
  });

  await prisma.subeKullanici.upsert({
    where: {
      kullaniciId_subeId: {
        kullaniciId: subeMuduru.id,
        subeId: sube.id,
      },
    },
    update: {},
    create: {
      kullaniciId: subeMuduru.id,
      subeId: sube.id,
    },
  });

  console.log('✅ Demo veri hazır.');
  console.log('   Süper Admin: admin@rebirth.com / admin123');
  console.log('   Şube Müdürü: mudur@rebirth.com / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
