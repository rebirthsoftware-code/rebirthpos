import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { YONETICI_ROLLER, AdisyonDurum, MasaDurum } from '../common/enums';
import { MockOkcAdapter } from '../okc/mock.adapter';
import { MockPosKartAdapter } from '../pos-kart/mock.adapter';
import { MockPaytrAdapter } from '../paytr/mock.adapter';
import { OkcFisIstegi, OkcKalem, OkcOdeme, OkcKdvSatiri } from '../okc/okc.types';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Beko/Ingenico gerçek cihazları gelene kadar geliştirici/test ekibinin
 * MOCK adapter davranışını çalıştırırken görüp kontrol edebilmesi için
 * dashboard endpoint'leri.
 *
 * Sentetik test endpoint'leri DB'yi etkilemez — sadece mock adapter'lara
 * doğrudan vurarak ekrandan görsel akışı test etmeye yarar.
 */

class TestAyarDto {
  @IsOptional() @IsIn(['AUTO', 'BASARI', 'HATA']) testMod?: 'AUTO' | 'BASARI' | 'HATA';
  @IsOptional() @IsInt() @Min(0) @Max(10000) gecikmeMs?: number;
}

class SentetikKartDto {
  @IsInt() @Min(1) @Max(100000) tutar!: number;
  @IsOptional() @IsString() referans?: string;
}

class SentetikOkcDto {
  @IsInt() @Min(1) @Max(1000000) toplamTutar!: number;
  @IsOptional() @IsString() adisyonNo?: string;
  // KDV oranı (% olarak): 1, 10, 20 gibi. Her oran için adil bir matrah/kdv hesaplanır
  @IsOptional() @IsArray() kdvOranlari?: number[];
  // Ödeme breakdown
  @IsOptional() @IsArray() odemeler?: Array<{ tip: string; tutar: number }>;
}

class StresTestDto {
  @IsOptional() @IsInt() @Min(1) @Max(100) sayi?: number;
  @IsOptional() @IsIn(['KART', 'OKC', 'HER_IKISI']) hedef?: 'KART' | 'OKC' | 'HER_IKISI';
}

function rastgeleArasinda(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Toplam tutarı verilen KDV oranlarına göre orantılı dağıtıp matrah+kdv
 * dökümünü üretir. Tek oran: 1 bant; çoklu oran: birden çok bant.
 */
function kdvDokumuUret(toplam: number, oranlar: number[]): OkcKdvSatiri[] {
  if (!oranlar.length) oranlar = [10];
  // Eşit dağılım (basit)
  const pay = toplam / oranlar.length;
  return oranlar.map((oran) => {
    // KDV dahil tutardan matrah ve KDV
    const matrah = Number((pay / (1 + oran / 100)).toFixed(2));
    const kdv = Number((pay - matrah).toFixed(2));
    return { oran, matrah, kdv };
  });
}

@Controller('cihaz-test')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...YONETICI_ROLLER)
export class CihazTestController {
  constructor(private prisma: PrismaService) {}

  @Get('durum')
  durum() {
    return {
      kart: {
        marka: 'MOCK',
        testMod: MockPosKartAdapter.testMod,
        gecikmeMs: MockPosKartAdapter.gecikmeMs,
        logSayisi: MockPosKartAdapter.log.length,
      },
      okc: {
        marka: 'MOCK',
        testMod: MockOkcAdapter.testMod,
        gecikmeMs: MockOkcAdapter.gecikmeMs,
        logSayisi: MockOkcAdapter.log.length,
      },
      paytr: {
        saglayici: 'MOCK',
        testMod: MockPaytrAdapter.testMod,
        gecikmeMs: MockPaytrAdapter.gecikmeMs,
        logSayisi: MockPaytrAdapter.log.length,
      },
    };
  }

  @Get('log/kart')
  kartLog() {
    return MockPosKartAdapter.log;
  }

  @Get('log/okc')
  okcLog() {
    return MockOkcAdapter.log;
  }

  @Get('log/paytr')
  paytrLog() {
    return MockPaytrAdapter.log;
  }

  @Post('kart/ayar')
  kartAyar(@Body() dto: TestAyarDto) {
    if (dto.testMod !== undefined) MockPosKartAdapter.testMod = dto.testMod;
    if (dto.gecikmeMs !== undefined) MockPosKartAdapter.gecikmeMs = dto.gecikmeMs;
    return { ok: true, testMod: MockPosKartAdapter.testMod, gecikmeMs: MockPosKartAdapter.gecikmeMs };
  }

  @Post('okc/ayar')
  okcAyar(@Body() dto: TestAyarDto) {
    if (dto.testMod !== undefined) MockOkcAdapter.testMod = dto.testMod;
    if (dto.gecikmeMs !== undefined) MockOkcAdapter.gecikmeMs = dto.gecikmeMs;
    return { ok: true, testMod: MockOkcAdapter.testMod, gecikmeMs: MockOkcAdapter.gecikmeMs };
  }

  @Post('paytr/ayar')
  paytrAyar(@Body() dto: TestAyarDto) {
    if (dto.testMod !== undefined) MockPaytrAdapter.testMod = dto.testMod;
    if (dto.gecikmeMs !== undefined) MockPaytrAdapter.gecikmeMs = dto.gecikmeMs;
    return { ok: true, testMod: MockPaytrAdapter.testMod, gecikmeMs: MockPaytrAdapter.gecikmeMs };
  }

  @Post('log/temizle')
  logTemizle() {
    MockPosKartAdapter.log.length = 0;
    MockOkcAdapter.log.length = 0;
    MockPaytrAdapter.log.length = 0;
    return { ok: true };
  }

  /**
   * TAM RESET — TEST ortamı için tüm geçmiş verileri sıfırlar:
   *   1) Mock cihaz log + sayaçlar (kart slip, ÖKC fiş, zNo, iade)
   *   2) DB: tüm açık/kapalı adisyonları IPTAL durumuna çek, ödemeleri iptal et
   *   3) Tüm masaları BOS durumuna çek
   * DESTRUCTIVE: gerçek satış verilerini etkiler. Sadece dev/test ortamı için.
   * Audit log temizlenmez (denetim izi korunur).
   */
  @Post('tam-reset')
  async tamReset() {
    // 1) Mock cihaz state
    MockOkcAdapter.log.length = 0;
    MockOkcAdapter.iadeler.length = 0;
    MockOkcAdapter.zNo = 0;
    MockOkcAdapter.iadeSayac = 0;
    MockOkcAdapter.sonZTarihi = null;
    MockPosKartAdapter.log.length = 0;
    MockPaytrAdapter.log.length = 0;

    // 2) DB temizliği — adisyonlar IPTAL, ödemeler iptal
    const sonuc = await this.prisma.$transaction(async (tx) => {
      const odemeUpdate = await tx.odeme.updateMany({
        where: { iptal: false },
        data: { iptal: true },
      });
      const adisyonUpdate = await tx.adisyon.updateMany({
        where: {
          durum: { in: [AdisyonDurum.ACIK, AdisyonDurum.ODEME_BEKLIYOR, AdisyonDurum.KAPALI] },
        },
        data: { durum: AdisyonDurum.IPTAL, kapanis: new Date() },
      });
      const masaUpdate = await tx.masa.updateMany({
        where: { durum: { not: MasaDurum.BOS } },
        data: { durum: MasaDurum.BOS },
      });
      return {
        odemeIptal: odemeUpdate.count,
        adisyonIptal: adisyonUpdate.count,
        masaSerbest: masaUpdate.count,
      };
    });

    return { ok: true, ...sonuc };
  }

  /**
   * Sistem (DB) vs ÖKC (Mock cihaz log) karşılaştırması.
   * Z raporu öncesi/sonrası eşleşme kontrolü için. Gerçek ÖKC sisteminde de
   * bu uyum şarttır — sistem raporu ile cihaz Z raporu rakamsal eşleşmeli.
   */
  @Get('karsilastirma')
  async karsilastirma() {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);

    // ── Sistem (DB) tarafı ──
    const sistemOdemeler = await this.prisma.odeme.groupBy({
      by: ['tip'],
      where: { iptal: false, olusturuldu: { gte: bugun } },
      _sum: { tutar: true },
      _count: { id: true },
    });
    const sistemFisliOdeme = await this.prisma.odeme.count({
      where: { iptal: false, okcFisNo: { not: null }, olusturuldu: { gte: bugun } },
    });
    const sistemToplam = sistemOdemeler.reduce(
      (s, o) => s + Number(o._sum.tutar || 0),
      0,
    );
    const sistemNakit = Number(
      sistemOdemeler.find((o) => o.tip === 'NAKIT')?._sum.tutar || 0,
    );
    const sistemKart = Number(
      sistemOdemeler.find((o) => o.tip === 'KREDI_KARTI')?._sum.tutar || 0,
    );

    // ── ÖKC (Mock cihaz log) tarafı ──
    const sonZ = MockOkcAdapter.sonZTarihi;
    const okcKapsam = MockOkcAdapter.log.filter((l) => {
      if (!l.basarili) return false;
      if (sonZ && new Date(l.zaman) <= sonZ) return false;
      return true;
    });
    let okcToplam = 0;
    let okcNakit = 0;
    let okcKart = 0;
    const okcKdvMap = new Map<number, number>();
    for (const fis of okcKapsam) {
      okcToplam += fis.toplamTutar;
      for (const o of fis.odemeler) {
        if (o.tip === 'NAKIT') okcNakit += o.tutar;
        else if (o.tip === 'KREDI_KARTI') okcKart += o.tutar;
      }
      for (const k of fis.kdvDokumu) {
        okcKdvMap.set(k.oran, (okcKdvMap.get(k.oran) || 0) + k.kdv);
      }
    }
    const okcKdvBantlari = Array.from(okcKdvMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([oran, kdv]) => ({ oran, kdv: Number(kdv.toFixed(2)) }));

    // ── Karşılaştırma satırları ──
    const eps = 0.01;
    const eslesir = (a: number, b: number) => Math.abs(a - b) < eps;

    return {
      sistem: {
        fisSayisi: sistemFisliOdeme,
        toplam: Number(sistemToplam.toFixed(2)),
        nakit: Number(sistemNakit.toFixed(2)),
        kart: Number(sistemKart.toFixed(2)),
      },
      okc: {
        fisSayisi: okcKapsam.length,
        toplam: Number(okcToplam.toFixed(2)),
        nakit: Number(okcNakit.toFixed(2)),
        kart: Number(okcKart.toFixed(2)),
        kdvBantlari: okcKdvBantlari,
      },
      uyum: {
        fisSayisi: sistemFisliOdeme === okcKapsam.length,
        toplam: eslesir(sistemToplam, okcToplam),
        nakit: eslesir(sistemNakit, okcNakit),
        kart: eslesir(sistemKart, okcKart),
        tumu:
          sistemFisliOdeme === okcKapsam.length &&
          eslesir(sistemToplam, okcToplam) &&
          eslesir(sistemNakit, okcNakit) &&
          eslesir(sistemKart, okcKart),
      },
    };
  }

  /** Mock kart adapter'ına doğrudan tek bir çekim gönderir (DB'ye yazılmaz). */
  @Post('sentetik/kart')
  async sentetikKart(@Body() dto: SentetikKartDto) {
    const adapter = new MockPosKartAdapter();
    return adapter.cek({ tutar: dto.tutar, referans: dto.referans });
  }

  /**
   * Mock PayTR sanal pos akışını uçtan uca dener (başlat → sonuç). DB'ye yazmaz —
   * sadece adapter davranışını ve log'u test eder.
   */
  @Post('sentetik/paytr')
  async sentetikPaytr(@Body() dto: SentetikKartDto) {
    const adapter = new MockPaytrAdapter();
    const siparisNo = dto.referans || `TEST-${Date.now().toString().slice(-8)}`;
    const baslat = await adapter.odemeBaslat({
      tutar: dto.tutar,
      adisyonId: 'sentetik',
      subeId: 'sentetik',
      siparisNo,
      musteriAd: 'Test Müşteri',
    });
    if (!baslat.basarili || !baslat.token) return { baslat };
    const sonuc = await adapter.sonucDogrula({ token: baslat.token, basariliMi: true });
    return { baslat, sonuc };
  }

  /** Mock ÖKC adapter'ına doğrudan tek bir fiş gönderir (DB'ye yazılmaz). */
  @Post('sentetik/okc')
  async sentetikOkc(@Body() dto: SentetikOkcDto) {
    const adapter = new MockOkcAdapter();
    const oranlar = dto.kdvOranlari?.length ? dto.kdvOranlari : [10];
    const kdvDokumu = kdvDokumuUret(dto.toplamTutar, oranlar);
    const odemeler: OkcOdeme[] = (dto.odemeler?.length
      ? dto.odemeler
      : [{ tip: 'NAKIT', tutar: dto.toplamTutar }]
    ).map((o) => ({ tip: o.tip as any, tutar: Number(o.tutar) }));
    const kalemler: OkcKalem[] = [
      { ad: 'Sentetik test ürünü', adet: 1, birimFiyat: dto.toplamTutar, toplam: dto.toplamTutar, kdvOrani: oranlar[0] },
    ];
    const istek: OkcFisIstegi = {
      adisyonNo: dto.adisyonNo || `TEST-${Date.now().toString().slice(-8)}`,
      kalemler,
      odemeler,
      kdvDokumu,
      araToplam: kdvDokumu.reduce((s, d) => s + d.matrah, 0),
      iskontoTutar: 0,
      toplamTutar: dto.toplamTutar,
    };
    return adapter.satisKaydet(istek);
  }

  /**
   * Stres testi: çok sayıda sentetik işlemi paralel atar. Mock adapter'lar
   * static log state'i paylaşıyor → tek seferde log birikir. Süre, başarı
   * oranı gibi metrikleri görmek için ideal.
   */
  @Post('stres-test')
  async stresTest(@Body() dto: StresTestDto) {
    const sayi = dto.sayi || 10;
    const hedef = dto.hedef || 'HER_IKISI';
    const kartAdapter = new MockPosKartAdapter();
    const okcAdapter = new MockOkcAdapter();
    const baslangic = Date.now();

    const isler: Promise<unknown>[] = [];
    for (let i = 0; i < sayi; i++) {
      const tutar = rastgeleArasinda(10, 5000);
      if (hedef === 'KART' || hedef === 'HER_IKISI') {
        isler.push(
          kartAdapter
            .cek({ tutar, referans: `STRES-${i + 1}` })
            .catch(() => null),
        );
      }
      if (hedef === 'OKC' || hedef === 'HER_IKISI') {
        // Yemek + içecek standardı: hep %10
        const oranlar = [10];
        const kdvDokumu = kdvDokumuUret(tutar, oranlar);
        const odemeTip = i % 2 === 0 ? 'NAKIT' : 'KREDI_KARTI';
        isler.push(
          okcAdapter
            .satisKaydet({
              adisyonNo: `STRES-${Date.now()}-${i + 1}`,
              kalemler: [
                { ad: `Test #${i + 1}`, adet: 1, birimFiyat: tutar, toplam: tutar, kdvOrani: 10 },
              ],
              odemeler: [{ tip: odemeTip as any, tutar }],
              kdvDokumu,
              araToplam: kdvDokumu.reduce((s, d) => s + d.matrah, 0),
              iskontoTutar: 0,
              toplamTutar: tutar,
            })
            .catch(() => null),
        );
      }
    }
    await Promise.all(isler);
    return {
      ok: true,
      sayi,
      hedef,
      sureMs: Date.now() - baslangic,
    };
  }
}
