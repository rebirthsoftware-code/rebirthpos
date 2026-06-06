import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PaytrService, PAYTR_ADAPTER } from './paytr.service';
import { MockPaytrAdapter } from './mock.adapter';
import { IPaytrAdapter } from './paytr.types';

@Module({
  imports: [ConfigModule],
  providers: [
    PaytrService,
    MockPaytrAdapter,
    {
      // Hangi sağlayıcı kullanılacağı PAYTR_MARKA env'inden gelir.
      // Gerçek entegre bilgileri (merchant_id/key/salt) gelince PaytrAdapter
      // eklenir ve buraya case 'PAYTR' eklenir — akışın geri kalanı değişmez.
      provide: PAYTR_ADAPTER,
      inject: [ConfigService, MockPaytrAdapter],
      useFactory: (config: ConfigService, mock: MockPaytrAdapter): IPaytrAdapter => {
        const marka = (config.get<string>('PAYTR_MARKA') || 'MOCK').toUpperCase();
        switch (marka) {
          case 'MOCK':
            return mock;
          default:
            // PAYTR adapter henüz yok (entegre bilgileri bekleniyor) — mock'a düş.
            return mock;
        }
      },
    },
  ],
  exports: [PaytrService],
})
export class PaytrModule {}
