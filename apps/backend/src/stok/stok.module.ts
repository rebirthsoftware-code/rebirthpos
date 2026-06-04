import { Module } from '@nestjs/common';
import { StokController } from './stok.controller';
import { StokService } from './stok.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [StokController],
  providers: [StokService],
  exports: [StokService],
})
export class StokModule {}
