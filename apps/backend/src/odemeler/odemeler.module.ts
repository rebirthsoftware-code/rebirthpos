import { Module } from '@nestjs/common';
import { OdemelerController } from './odemeler.controller';
import { OdemelerService } from './odemeler.service';
import { DenetimModule } from '../denetim/denetim.module';
import { PosKartModule } from '../pos-kart/pos-kart.module';

@Module({
  imports: [DenetimModule, PosKartModule],
  controllers: [OdemelerController],
  providers: [OdemelerService],
})
export class OdemelerModule {}
