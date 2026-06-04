import { Module } from '@nestjs/common';
import { KullanicilarController } from './kullanicilar.controller';
import { KullanicilarService } from './kullanicilar.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [KullanicilarController],
  providers: [KullanicilarService],
})
export class KullanicilarModule {}
