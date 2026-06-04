import { Module } from '@nestjs/common';
import { SiparislerController } from './siparisler.controller';
import { SiparislerService } from './siparisler.service';
import { AdisyonlarModule } from '../adisyonlar/adisyonlar.module';
import { StokModule } from '../stok/stok.module';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [AdisyonlarModule, StokModule, DenetimModule],
  controllers: [SiparislerController],
  providers: [SiparislerService],
})
export class SiparislerModule {}
