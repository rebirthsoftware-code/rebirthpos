import { Module } from '@nestjs/common';
import { AdisyonlarController } from './adisyonlar.controller';
import { AdisyonlarService } from './adisyonlar.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [AdisyonlarController],
  providers: [AdisyonlarService],
  exports: [AdisyonlarService],
})
export class AdisyonlarModule {}
