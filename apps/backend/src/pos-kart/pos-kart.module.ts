import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PosKartController } from './pos-kart.controller';
import { PosKartService, POS_KART_ADAPTER } from './pos-kart.service';
import { MockPosKartAdapter } from './mock.adapter';
import { IPosKartAdapter } from './pos-kart.types';

@Module({
  imports: [ConfigModule],
  controllers: [PosKartController],
  providers: [
    PosKartService,
    MockPosKartAdapter,
    {
      // Hangi adapter kullanılacağı POS_KART_MARKA env'inden gelir.
      // Gerçek SDK gelince IngenicoAdapter/PavoAdapter eklenir, switch case yapılır.
      provide: POS_KART_ADAPTER,
      inject: [ConfigService, MockPosKartAdapter],
      useFactory: (config: ConfigService, mock: MockPosKartAdapter): IPosKartAdapter => {
        const marka = (config.get<string>('POS_KART_MARKA') || 'MOCK').toUpperCase();
        switch (marka) {
          case 'MOCK':
            return mock;
          default:
            // INGENICO / PAVO / VERIFONE için adapter henüz yok — şimdilik mock'a düş
            return mock;
        }
      },
    },
  ],
  exports: [PosKartService],
})
export class PosKartModule {}
