import { Module } from '@nestjs/common';
import { MusterilerController } from './musteriler.controller';
import { MusterilerService } from './musteriler.service';
import { DenetimModule } from '../denetim/denetim.module';

@Module({
  imports: [DenetimModule],
  controllers: [MusterilerController],
  providers: [MusterilerService],
})
export class MusterilerModule {}
