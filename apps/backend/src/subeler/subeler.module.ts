import { Module } from '@nestjs/common';
import { SubelerController } from './subeler.controller';
import { SubelerService } from './subeler.service';

@Module({
  controllers: [SubelerController],
  providers: [SubelerService],
})
export class SubelerModule {}
