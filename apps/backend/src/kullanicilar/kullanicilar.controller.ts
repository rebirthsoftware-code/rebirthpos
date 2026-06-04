import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { KullanicilarService } from './kullanicilar.service';
import { KullaniciCreateDto, KullaniciUpdateDto } from './dto/kullanici.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('kullanicilar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KullanicilarController {
  constructor(private kullanicilar: KullanicilarService) {}

  // Kuryeler endpoint'i — paket modülü tarafından okunuyor (GARSON/KASIYER atama),
  // yönetici sınırı koymuyoruz.
  @Get('kuryeler')
  kuryeler(@Query('subeId') subeId: string, @CurrentUser() user: CurrentUserData) {
    return this.kullanicilar.kuryeListesi(user, subeId);
  }

  // Kullanıcı yönetimi: tüm CRUD yönetici.
  @Roles(...YONETICI_ROLLER)
  @Get()
  liste(@CurrentUser() user: CurrentUserData) {
    return this.kullanicilar.liste(user);
  }

  @Roles(...YONETICI_ROLLER)
  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.kullanicilar.getir(id, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Post()
  olustur(@Body() dto: KullaniciCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.kullanicilar.olustur(dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Patch(':id')
  guncelle(@Param('id') id: string, @Body() dto: KullaniciUpdateDto, @CurrentUser() user: CurrentUserData) {
    return this.kullanicilar.guncelle(id, dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.kullanicilar.sil(id, user);
  }
}
