import { Controller, Get } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      service: 'rebirth-pos-backend',
      time: new Date().toISOString(),
    };
  }

  /**
   * Veritabanı teşhisi (public): bağlantı çalışıyor mu, ana tablolarda kaç
   * kayıt var, hata varsa ham sebebi. "Giriş oluyor ama hiçbir şey
   * görünmüyor/oluşmuyor" durumlarında DB sorununu kesin ayırt etmek için.
   * Tarayıcıdan: /api/health/db
   */
  @Get('db')
  async db() {
    const t0 = Date.now();
    try {
      // 1) Ham bağlantı testi
      await this.prisma.$queryRaw`SELECT 1`;
      // 2) Ana tablolar — hem bağlantıyı hem şema/veri varlığını gösterir
      const [firma, sube, masa, kat, kullanici, urun, adisyon] = await Promise.all([
        this.prisma.firma.count(),
        this.prisma.sube.count(),
        this.prisma.masa.count(),
        this.prisma.kat.count(),
        this.prisma.kullanici.count(),
        this.prisma.urun.count(),
        this.prisma.adisyon.count(),
      ]);
      return {
        db: 'ok',
        sureMs: Date.now() - t0,
        // DATABASE_URL'in hangi host'a baktığını (şifresiz) göster — yanlış/boş DB tespiti
        host: dbHost(),
        sayim: { firma, sube, masa, kat, kullanici, urun, adisyon },
      };
    } catch (e: any) {
      return {
        db: 'HATA',
        sureMs: Date.now() - t0,
        host: dbHost(),
        hataTipi: e?.constructor?.name,
        kod: e?.code,
        mesaj: typeof e?.message === 'string' ? e.message.slice(0, 600) : String(e),
      };
    }
  }
}

/** DATABASE_URL'den yalnız host kısmını çıkar (şifre/parametre sızdırmadan). */
function dbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return 'TANIMSIZ (DATABASE_URL yok!)';
  try {
    const u = new URL(url);
    return u.host;
  } catch {
    return 'çözümlenemedi';
  }
}
