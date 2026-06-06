import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { FirmalarModule } from './firmalar/firmalar.module';
import { SubelerModule } from './subeler/subeler.module';
import { KategorilerModule } from './kategoriler/kategoriler.module';
import { UrunlerModule } from './urunler/urunler.module';
import { KatlarModule } from './katlar/katlar.module';
import { MasalarModule } from './masalar/masalar.module';
import { AdisyonlarModule } from './adisyonlar/adisyonlar.module';
import { SiparislerModule } from './siparisler/siparisler.module';
import { OdemelerModule } from './odemeler/odemeler.module';
import { QrModule } from './qr/qr.module';
import { RealtimeModule } from './realtime/realtime.module';
import { KullanicilarModule } from './kullanicilar/kullanicilar.module';
import { MusterilerModule } from './musteriler/musteriler.module';
import { PaketModule } from './paket/paket.module';
import { StokModule } from './stok/stok.module';
import { RaporlarModule } from './raporlar/raporlar.module';
import { DenetimModule } from './denetim/denetim.module';
import { OkcModule } from './okc/okc.module';
import { PosKartModule } from './pos-kart/pos-kart.module';
import { PaytrModule } from './paytr/paytr.module';
import { CihazTestModule } from './cihaz-test/cihaz-test.module';
import { EBelgeModule } from './e-belge/e-belge.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    // Genel default: 100/dakika per IP. Hassas endpoint'ler kendi
    // @Throttle dekoratörleriyle daha sıkı limit kurar.
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },
      { name: 'default', ttl: 60_000, limit: 100 },
    ]),
    PrismaModule,
    AuthModule,
    FirmalarModule,
    SubelerModule,
    KategorilerModule,
    UrunlerModule,
    KatlarModule,
    MasalarModule,
    RealtimeModule,
    AdisyonlarModule,
    SiparislerModule,
    OdemelerModule,
    QrModule,
    KullanicilarModule,
    MusterilerModule,
    PaketModule,
    StokModule,
    RaporlarModule,
    DenetimModule,
    OkcModule,
    PosKartModule,
    PaytrModule,
    CihazTestModule,
    EBelgeModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
