import { Module } from '@nestjs/common';
import { RaporlarController } from './raporlar.controller';
import { RaporlarService } from './raporlar.service';

@Module({
  controllers: [RaporlarController],
  providers: [RaporlarService],
})
export class RaporlarModule {}
