import { Module } from '@nestjs/common';
import { DenetimService } from './denetim.service';
import { DenetimController } from './denetim.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DenetimController],
  providers: [DenetimService],
  exports: [DenetimService],
})
export class DenetimModule {}
