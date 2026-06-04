import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EBelgeController } from './e-belge.controller';
import { EBelgeService, EBELGE_ADAPTER } from './e-belge.service';
import { MockEBelgeAdapter } from './mock.adapter';
import { DenetimModule } from '../denetim/denetim.module';
import { IEBelgeAdapter } from './e-belge.types';

@Module({
  imports: [DenetimModule, ConfigModule],
  controllers: [EBelgeController],
  providers: [
    EBelgeService,
    MockEBelgeAdapter,
    {
      // Hangi entegratör kullanılacağı E_BELGE_ENTEGRATOR env'inden gelir.
      // MOCK (dev) | LOGO | EFINANS | UYUMSOFT | FORIBA gelince swap.
      provide: EBELGE_ADAPTER,
      inject: [ConfigService, MockEBelgeAdapter],
      useFactory: (config: ConfigService, mock: MockEBelgeAdapter): IEBelgeAdapter => {
        const marka = (config.get<string>('E_BELGE_ENTEGRATOR') || 'MOCK').toUpperCase();
        switch (marka) {
          case 'MOCK':
            return mock;
          default:
            return mock;
        }
      },
    },
  ],
  exports: [EBelgeService],
})
export class EBelgeModule {}
