import { Module } from '@nestjs/common';
import { MasalarController } from './masalar.controller';
import { MasalarService } from './masalar.service';

@Module({
  controllers: [MasalarController],
  providers: [MasalarService],
})
export class MasalarModule {}
