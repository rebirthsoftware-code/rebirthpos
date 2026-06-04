import { Module } from '@nestjs/common';
import { FirmalarController } from './firmalar.controller';
import { FirmalarService } from './firmalar.service';

@Module({
  controllers: [FirmalarController],
  providers: [FirmalarService],
})
export class FirmalarModule {}
