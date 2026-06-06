import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { QrService } from './qr.service';
import { QrOdemeBaslatDto, QrOdemeSonucDto, QrSiparisDto } from './dto/qr.dto';

/**
 * Public endpoint'ler — QR menüden müşteri kullanır, auth yoktur.
 * Throttle limitleri public olmaktan dolayı sıkı tutulur (bot/spam koruması).
 */
@Controller('qr')
export class QrController {
  constructor(private qr: QrService) {}

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('menu')
  menu(@Query('subeId') subeId: string) {
    return this.qr.menu(subeId);
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('masa/:id')
  masaBilgi(@Param('id') id: string) {
    return this.qr.masaBilgi(id);
  }

  // Sipariş tetikleme spam'e kapalı olmalı — 10 sipariş/dakika/IP yeterli.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('siparis')
  siparis(@Body() dto: QrSiparisDto) {
    return this.qr.siparisAl(dto);
  }

  // Masanın güncel hesabı (müşteri kendi hesabını görüp öder).
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Get('masa/:id/hesap')
  masaHesap(@Param('id') id: string) {
    return this.qr.masaHesap(id);
  }

  // PayTR sanal pos ödeme oturumu başlat — token döner.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('odeme/baslat')
  odemeBaslat(@Body() dto: QrOdemeBaslatDto) {
    return this.qr.odemeBaslat(dto);
  }

  // PayTR sanal pos ödeme sonucu — onaylandıysa Odeme kaydı oluşturulur.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('odeme/sonuc')
  odemeSonuc(@Body() dto: QrOdemeSonucDto) {
    return this.qr.odemeSonuc(dto);
  }
}
