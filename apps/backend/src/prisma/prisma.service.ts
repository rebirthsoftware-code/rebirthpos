import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { neonConfig, Pool } from '@neondatabase/serverless';
import ws from 'ws';

// Neon bağlantısı (Vercel serverless uyumlu):
//  - poolQueryViaFetch: tek-atışlık sorgular (SELECT/COUNT) HTTP (fetch / 443)
//    üzerinden → query-engine binary ve TCP pooling derdi yok.
//  - webSocketConstructor: TRANSACTION'lar (yazma + $transaction) WebSocket
//    ister. Node ortamında global WebSocket yoktur; 'ws' verilmezse masa/şube
//    create, ödeme, denetim gibi tüm yazma işlemleri transaction hatasına düşer
//    (okuma çalışır ama yazma 500 verir).
neonConfig.poolQueryViaFetch = true;
neonConfig.webSocketConstructor = ws as any;

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
