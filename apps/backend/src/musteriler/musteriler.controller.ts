import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { MusterilerService } from './musteriler.service';
import { MusteriCreateDto, MusteriUpdateDto } from './dto/musteri.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('musteriler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MusterilerController {
  constructor(private musteriler: MusterilerService) {}

  // Listeleme + arama: KASIYER/GARSON paket alırken müşteri arayabilmeli.
  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('arama') arama?: string,
  ) {
    return this.musteriler.liste(user, subeId, arama);
  }

  @Get('telefon')
  telefonAra(
    @Query('subeId') subeId: string,
    @Query('telefon') telefon: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.musteriler.telefonAra(subeId, telefon, user);
  }

  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.musteriler.getir(id, user);
  }

  // Müşteri oluştur/güncelle: paket sipariş akışında her rolün erişimi olur.
  @Post()
  olustur(@Body() dto: MusteriCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.musteriler.olustur(dto, user);
  }

  @Patch(':id')
  guncelle(@Param('id') id: string, @Body() dto: MusteriUpdateDto, @CurrentUser() user: CurrentUserData) {
    return this.musteriler.guncelle(id, dto, user);
  }

  // Sil: yönetici. KASIYER müşteri kaydını silemez — geçmiş paket adisyonu izi korunur.
  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.musteriler.sil(id, user);
  }
}
