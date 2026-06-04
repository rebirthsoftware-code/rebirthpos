import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UrunlerService } from './urunler.service';
import { UrunCreateDto, UrunUpdateDto } from './dto/urun.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { YONETICI_ROLLER } from '../common/enums';

@Controller('urunler')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UrunlerController {
  constructor(private urunler: UrunlerService) {}

  @Get()
  liste(
    @CurrentUser() user: CurrentUserData,
    @Query('subeId') subeId?: string,
    @Query('kategoriId') kategoriId?: string,
  ) {
    return this.urunler.liste(user, subeId, kategoriId);
  }

  @Get(':id')
  getir(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.urunler.getir(id, user);
  }

  // Ürün ekleme, fiyat/KDV değişimi, silme: sadece yöneticiler.
  // KASIYER/GARSON satış yaparken fiyat manipüle edemez.
  @Roles(...YONETICI_ROLLER)
  @Post()
  olustur(@Body() dto: UrunCreateDto, @CurrentUser() user: CurrentUserData) {
    return this.urunler.olustur(dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Patch(':id')
  guncelle(
    @Param('id') id: string,
    @Body() dto: UrunUpdateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.urunler.guncelle(id, dto, user);
  }

  @Roles(...YONETICI_ROLLER)
  @Delete(':id')
  sil(@Param('id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.urunler.sil(id, user);
  }
}
