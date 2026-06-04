import {
  Body,
  Controller,
  Get,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PosKartService } from './pos-kart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class CekDto {
  @IsNumber()
  @Min(0.01)
  tutar!: number;

  @IsOptional()
  @IsString()
  referans?: string;
}

class IadeDto {
  @IsString()
  orijinalSlipNo!: string;

  @IsNumber()
  @Min(0.01)
  tutar!: number;
}

@Controller('poskart')
@UseGuards(JwtAuthGuard)
export class PosKartController {
  constructor(private poskart: PosKartService) {}

  @Get('durum')
  durum() {
    return this.poskart.durum();
  }

  // Saatte 60 işlem üst sınır — yığılma/abuse koruması.
  // Idempotency ödeme tarafında: aynı kart işlemi iki kez basılırsa
  // ödeme idempotencyKey'i çift kayıt atmaz.
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('cek')
  cek(@Body() dto: CekDto) {
    return this.poskart.cek({ tutar: dto.tutar, referans: dto.referans });
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('iade')
  iade(@Body() dto: IadeDto) {
    return this.poskart.iade({ orijinalSlipNo: dto.orijinalSlipNo, tutar: dto.tutar });
  }
}
