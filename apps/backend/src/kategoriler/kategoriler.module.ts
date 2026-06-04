import { Module } from '@nestjs/common';
import { KategorilerController } from './kategoriler.controller';
import { KategorilerService } from './kategoriler.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [KategorilerController],
  providers: [KategorilerService],
})
export class KategorilerModule {}
