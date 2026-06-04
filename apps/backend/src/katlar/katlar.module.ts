import { Module } from '@nestjs/common';
import { KatlarController } from './katlar.controller';
import { KatlarService } from './katlar.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [KatlarController],
  providers: [KatlarService],
})
export class KatlarModule {}
