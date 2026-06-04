import { Module } from '@nestjs/common';
import { CihazTestController } from './cihaz-test.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CihazTestController],
})
export class CihazTestModule {}
