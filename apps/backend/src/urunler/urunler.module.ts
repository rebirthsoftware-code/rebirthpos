import { Module } from '@nestjs/common';
import { UrunlerController } from './urunler.controller';
import { UrunlerService } from './urunler.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [UrunlerController],
  providers: [UrunlerService],
})
export class UrunlerModule {}
