import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OkcController } from './okc.controller';
import { OkcService, OKC_ADAPTER } from './okc.service';
import { MockOkcAdapter } from './mock.adapter';
import { DenetimModule } from '../denetim/denetim.module';
import { IOkcAdapter } from './okc.types';

@Module({
  imports: [DenetimModule, ConfigModule],
  controllers: [OkcController],
  providers: [
    OkcService,
    MockOkcAdapter,
    {
      // Hangi adapter kullanılacağı OKC_MARKA env'inden gelir.
      // Faz 9'da BekoAdapter / IngenicoAdapter eklenir, burada switch case yapılır.
      provide: OKC_ADAPTER,
      inject: [ConfigService, MockOkcAdapter],
      useFactory: (config: ConfigService, mock: MockOkcAdapter): IOkcAdapter => {
        const marka = (config.get<string>('OKC_MARKA') || 'MOCK').toUpperCase();
        switch (marka) {
          case 'MOCK':
            return mock;
          default:
            // BEKO/INGENICO için adapter henüz yok — şimdilik mock'a düş
            return mock;
        }
      },
    },
  ],
})
export class OkcModule {}
