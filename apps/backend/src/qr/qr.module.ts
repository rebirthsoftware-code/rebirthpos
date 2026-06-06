import { Module } from '@nestjs/common';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { PaytrModule } from '../paytr/paytr.module';

@Module({
  imports: [PaytrModule],
  controllers: [QrController],
  providers: [QrService],
})
export class QrModule {}
