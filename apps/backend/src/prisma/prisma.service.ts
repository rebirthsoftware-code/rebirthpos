import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig, Pool } from '@neondatabase/serverless';

// Neon'a HTTP (fetch / 443) üzerinden bağlan. Böylece:
//  - Vercel serverless'ta TCP pooling ve query-engine binary derdi olmaz
//  - 5432 portu kapalı ortamlarda bile çalışır
neonConfig.poolQueryViaFetch = true;

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaNeon(pool);
    super({ adapter });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
