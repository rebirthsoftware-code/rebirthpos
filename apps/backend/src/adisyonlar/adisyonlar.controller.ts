import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdisyonlarService } from './adisyonlar.service';
import { AdisyonAcDto, AdisyonGuncelleDto } from './dto/adisyon.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('adisyonlar')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdisyonlarController {
  constructor(private adisyonlar: AdisyonlarService) {}

  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('durum') durum?: string,
  ) {
    return this.adisyonlar.liste(user, subeId, durum);
  }

  @Get('masa/:masaId')
  masaIcinAktif(@Param('masaId') masaId: string, @CurrentUser() user: CurrentUserData) {
    return this.adisyonlar.masaIcinAktif(masaId, user);
  }

  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.adisyonlar.getir(id, user);
  }

  // Adisyon açma: KASIYER/GARSON da yapabilir — guard yok.
  @Post()
  ac(@Body() dto: AdisyonAcDto, @CurrentUser() user: CurrentUserData) {
    return this.adisyonlar.ac(dto, user);
  }

  // İskonto/not güncelleme: yönetici. KASIYER kendi başına iskonto uygulayamaz.
  @Roles(...YONETICI_ROLLER)
  @Patch(':id')
  guncelle(
    @Param('id') id: string,
    @Body() dto: AdisyonGuncelleDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.adisyonlar.guncelle(id, dto, user);
  }

  // Adisyon iptali: yönetici. Yanlışlıkla açılan adisyon iptal hakkı yöneticide.
  @Roles(...YONETICI_ROLLER)
  @Post(':id/iptal')
  iptal(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.adisyonlar.iptal(id, user);
  }
}
